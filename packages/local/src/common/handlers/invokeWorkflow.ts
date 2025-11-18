import {
  InvokeTimeoutError,
  isOpResult,
  toJsonError,
  type OpResults,
} from "@stepkit/sdk-tools";

import { UnreachableError } from "../errors";
import type { LocalStateDriver } from "../stateDriver";
import { startWorkflow } from "../utils";
import { nextAttempt, type OpHandlers } from "./common";

export const invokeWorkflowHandlers: OpHandlers = {
  execQueue: async ({ queueItem, stateDriver }): Promise<boolean> => {
    let handled = false;
    if (queueItem.prevOpResult === undefined) {
      return handled;
    }
    if (!isOpResult.invokeWorkflow(queueItem.prevOpResult)) {
      return handled;
    }
    handled = true;

    await timeoutInvokeWorkflowOp({
      hashedOpId: queueItem.prevOpResult.id.hashed,
      runId: queueItem.runId,
      stateDriver,
    });
    return handled;
  },

  opResult: async ({
    execQueue,
    op,
    queueItem,
    stateDriver,
    workflowId,
    workflows,
  }): Promise<boolean> => {
    let handled = false;
    if (!isOpResult.invokeWorkflow(op)) {
      return handled;
    }
    handled = true;

    const childWorkflow = workflows.get(op.config.options.workflowId);
    if (childWorkflow === undefined) {
      throw new UnreachableError("child workflow not found");
    }

    const invokedStartData = await startWorkflow({
      data: op.config.options.data,
      execQueue,

      // TODO
      maxAttempts: 4,

      stateDriver,
      workflowId: op.config.options.workflowId,
    });
    await stateDriver.waitingInvokes.add({
      op,
      childRun: {
        runId: invokedStartData.runId,
        workflowId: op.config.options.workflowId,
      },
      parentRun: {
        runId: queueItem.runId,
        workflowId,
      },
    });

    await execQueue.add({
      data: {
        attempt: nextAttempt(op, queueItem),
        maxAttempts: queueItem.maxAttempts,
        prevOpResult: op,
        runId: queueItem.runId,
        workflowId: queueItem.workflowId,
      },
      time: Date.now() + op.config.options.timeout,
    });

    return handled;
  },
};

async function timeoutInvokeWorkflowOp({
  hashedOpId,
  runId,
  stateDriver,
}: {
  hashedOpId: string;
  runId: string;
  stateDriver: LocalStateDriver;
}): Promise<void> {
  const waitingInvoke = await stateDriver.waitingInvokes.popByParentOp({
    hashedOpId,
    runId,
  });
  if (waitingInvoke === null) {
    return;
  }

  const error = new InvokeTimeoutError({
    childRunId: waitingInvoke.childRun.runId,
  });

  const opResult: OpResults["invokeWorkflow"] = {
    config: waitingInvoke.op.config,
    id: waitingInvoke.op.id,
    result: {
      status: "error",
      error: toJsonError(error),
    },
  };
  await stateDriver.setOp(
    {
      hashedOpId: waitingInvoke.op.id.hashed,
      runId: waitingInvoke.parentRun.runId,
    },
    opResult,
    { force: true }
  );
}
