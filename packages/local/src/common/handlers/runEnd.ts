import {
  disableRetries,
  fromJsonError,
  getStepKitErrorProps,
  OpMode,
  StdOpCode,
  type OpResult,
  type OpResults,
} from "@stepkit/sdk-tools";

import type { ExecQueueData, SortedQueue } from "../queue";
import type { LocalStateDriver } from "../stateDriver";
import { type OpHandlers } from "./common";

export const runEndHandlers: OpHandlers = {
  execQueue: async (): Promise<boolean> => {
    return false;
  },

  opResult: async ({
    execQueue,
    op,
    queueItem,
    stateDriver,
  }): Promise<boolean> => {
    let handled = false;
    if (!shouldEndRun(op, queueItem)) {
      return handled;
    }
    handled = true;

    await stateDriver.endRun(queueItem.runId, op);
    await resumeWaitingInvoke({ execQueue, op, queueItem, stateDriver });
    return handled;
  },
};

/**
 * Determines if the run should end
 */
function shouldEndRun(op: OpResult, queueItem: ExecQueueData): boolean {
  if (op.result.status === "success") {
    if (op.config.code === StdOpCode.workflow) {
      // Run was successful
      return true;
    }
    // Step was successful
    return false;
  }

  const error = fromJsonError(op.result.error);
  const canRetry = getStepKitErrorProps(error)?.canRetry ?? true;
  if (!canRetry) {
    // Non-retryable error
    return true;
  }

  const exhaustedAttempts = queueItem.attempt >= queueItem.maxAttempts;
  if (!exhaustedAttempts) {
    // Has remaining attempts
    return false;
  }

  if (op.config.code === StdOpCode.workflow) {
    // Workflow-level error with no remaining attempts
    return true;
  }

  // Step-level error with no remaining attempts. But the run is not done yet
  // since the error needs to be thrown at the workflow level
  return false;
}

async function resumeWaitingInvoke({
  execQueue,
  op,
  queueItem,
  stateDriver,
}: {
  execQueue: SortedQueue<ExecQueueData>;
  op: OpResult;
  queueItem: ExecQueueData;
  stateDriver: LocalStateDriver;
}): Promise<boolean> {
  let resumed = false;
  const waitingInvoke = await stateDriver.waitingInvokes.popByChildRun(
    queueItem.runId
  );
  if (waitingInvoke === null) {
    return resumed;
  }
  resumed = true;

  if (op.result.status === "error") {
    op.result.error = disableRetries(op.result.error);
  }

  const opResult: OpResults["invokeWorkflow"] = {
    config: {
      ...waitingInvoke.op.config,
      mode: OpMode.immediate,
    },
    opId: waitingInvoke.op.opId,
    result: op.result,
    runId: waitingInvoke.parentRun.runId,
    workflowId: waitingInvoke.parentRun.workflowId,
  };
  await stateDriver.setOp(
    {
      hashedOpId: waitingInvoke.op.opId.hashed,
      runId: opResult.runId,
    },
    opResult
  );

  await execQueue.add({
    data: {
      attempt: 1,
      maxAttempts: queueItem.maxAttempts,
      prevOpResult: opResult,
      runId: opResult.runId,
      workflowId: opResult.workflowId,
    },
    time: Date.now(),
  });
  return resumed;
}
