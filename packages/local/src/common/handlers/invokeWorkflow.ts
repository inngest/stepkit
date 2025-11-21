import {
  InvokeTimeoutError,
  isOpResult,
  OpMode,
  toJsonError,
  type OpResults,
} from "@stepkit/sdk-tools";

import { defaultMaxAttempts } from "../consts";
import { UnreachableError } from "../errors";
import { type ExecQueueData } from "../queue";
import type { LocalStateDriver } from "../stateDriver";
import { startWorkflow } from "../utils";
import { nextAttempt, type OpHandlers } from "./common";

export const invokeWorkflowHandlers: OpHandlers = {
  execQueue: async ({ queueItem, stateDriver }) => {
    let handled = false;
    const { action } = queueItem;
    if (action.code !== "invokeWorkflow.timeout") {
      return { handled };
    }
    handled = true;

    const isEnded =
      (await stateDriver.getOp({
        hashedOpId: action.opResult.opId.hashed,
        runId: queueItem.runId,
      })) !== undefined;
    if (isEnded) {
      return {
        // Don't allow execution because this timeout was invalidated
        allowExecution: false,

        handled,
      };
    }

    await timeoutInvokeWorkflowOp({
      hashedOpId: action.opResult.opId.hashed,
      queueItem,
      stateDriver,
    });
    return { handled };
  },

  opResult: async ({ execQueue, op, queueItem, stateDriver, workflows }) => {
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
      maxAttempts: childWorkflow.maxAttempts ?? defaultMaxAttempts,
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
        workflowId: queueItem.workflowId,
      },
    });

    await execQueue.add({
      data: {
        action: {
          code: "invokeWorkflow.timeout",
          opResult: op,
        },
        attempt: nextAttempt(op, queueItem),
        maxAttempts: queueItem.maxAttempts,
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
  queueItem,
  stateDriver,
}: {
  hashedOpId: string;
  queueItem: ExecQueueData;
  stateDriver: LocalStateDriver;
}): Promise<void> {
  const waitingInvoke = await stateDriver.waitingInvokes.popByParentOp({
    hashedOpId,
    runId: queueItem.runId,
  });
  if (waitingInvoke === null) {
    return;
  }

  const error = new InvokeTimeoutError({
    childRunId: waitingInvoke.childRun.runId,
  });

  const opResult: OpResults["invokeWorkflow"] = {
    config: {
      ...waitingInvoke.op.config,
      mode: OpMode.immediate,
    },
    opId: waitingInvoke.op.opId,
    result: {
      status: "error",
      error: toJsonError(error),
    },
    runId: waitingInvoke.parentRun.runId,
    workflowId: waitingInvoke.parentRun.workflowId,
  };
  await stateDriver.setOp(
    {
      hashedOpId: waitingInvoke.op.opId.hashed,
      runId: waitingInvoke.parentRun.runId,
    },
    opResult
  );
}
