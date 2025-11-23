import {
  isOpResult,
  type OpResults,
  type SendSignalOpts,
  type Workflow,
} from "@stepkit/sdk-tools";

import { defaultMaxAttempts } from "../consts";
import { UnreachableError } from "../errors";
import { type ExecQueueData, type SortedQueue } from "../queue";
import type { LocalStateDriver, WaitingSignal } from "../stateDriver";
import { nextAttempt, type OpHandlers } from "./common";

export const waitForSignalHandlers: OpHandlers = {
  execQueue: async ({ queueItem, stateDriver }) => {
    let handled = false;
    const { action } = queueItem;
    if (action.code !== "waitForSignal.timeout") {
      return { handled };
    }
    handled = true;

    const existingOp = await stateDriver.getOp({
      hashedOpId: action.opResult.opId.hashed,
      runId: queueItem.runId,
    });
    const isEnded =
      existingOp !== undefined && existingOp.result.status !== "plan";
    if (isEnded) {
      return {
        // Don't allow execution because this timeout was invalidated
        allowExecution: false,

        handled,
      };
    }
    const waitingSignal = await stateDriver.waitingSignals.pop(
      action.opResult.config.options.signal
    );
    if (waitingSignal === null) {
      return { handled };
    }
    await timeoutWaitForSignalOp({
      op: action.opResult,
      stateDriver,
      waitingSignal,
    });
    return { handled };
  },

  opResult: async ({ execQueue, op, queueItem, stateDriver }) => {
    let handled = false;
    if (!isOpResult.waitForSignal(op)) {
      return handled;
    }
    handled = true;

    await stateDriver.waitingSignals.add({
      op,
      runId: queueItem.runId,
      workflowId: queueItem.workflowId,
    });
    await execQueue.add({
      data: {
        action: {
          code: "waitForSignal.timeout",
          opResult: op,
        },
        attempt: nextAttempt(op, queueItem),
        maxAttempts: queueItem.maxAttempts,
        runId: queueItem.runId,
        workflowId: queueItem.workflowId,
      },
      time: Date.now() + op.config.options.timeout,
    });
    return true;
  },
};

/**
 * Process a signal that was sent by a client
 */
export async function processIncomingSignal({
  opts,
  stateDriver,
  workflows,
  execQueue,
}: {
  opts: SendSignalOpts;
  stateDriver: LocalStateDriver;
  workflows: Map<string, Workflow<any, any>>;
  execQueue: SortedQueue<ExecQueueData>;
}): Promise<string | null> {
  const waitingSignal = await stateDriver.waitingSignals.pop(opts.signal);
  if (waitingSignal === null) {
    return null;
  }

  const workflow = workflows.get(waitingSignal.workflowId);
  if (workflow === undefined) {
    throw new UnreachableError("workflow not found");
  }

  await resumeWaitForSignalOp({
    data: opts.data,
    stateDriver,
    waitingSignal,
  });

  await execQueue.add({
    data: {
      action: { code: "discover" },
      attempt: 1,
      runId: waitingSignal.runId,
      maxAttempts: workflow.maxAttempts ?? defaultMaxAttempts,
      workflowId: waitingSignal.workflowId,
    },
    time: Date.now(),
  });
  return waitingSignal.runId;
}

/**
 * Resume a `step.waitForSignal` op
 */
async function resumeWaitForSignalOp({
  data,
  stateDriver,
  waitingSignal,
}: {
  data: unknown;
  stateDriver: LocalStateDriver;
  waitingSignal: WaitingSignal;
}): Promise<void> {
  const opResult: OpResults["waitForSignal"] = {
    config: waitingSignal.op.config,
    opId: waitingSignal.op.opId,
    result: {
      status: "success",
      output: {
        data,
        signal: waitingSignal.op.config.options.signal,
      },
    },
    runId: waitingSignal.runId,
    workflowId: waitingSignal.workflowId,
  };
  await stateDriver.setOp(
    {
      hashedOpId: waitingSignal.op.opId.hashed,
      runId: waitingSignal.runId,
    },
    opResult
  );
}

/**
 * Timeout a `step.waitForSignal` op
 */
async function timeoutWaitForSignalOp({
  op,
  stateDriver,
  waitingSignal,
}: {
  op: OpResults["waitForSignal"];
  stateDriver: LocalStateDriver;
  waitingSignal: WaitingSignal;
}): Promise<void> {
  await stateDriver.setOp(
    {
      hashedOpId: waitingSignal.op.opId.hashed,
      runId: waitingSignal.runId,
    },
    {
      ...op,
      result: {
        status: "success",
        output: null,
      },
    }
  );
}
