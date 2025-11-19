import {
  isOpResult,
  OpMode,
  StdOpCode,
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
    if (queueItem.prevOpResult === undefined) {
      return { handled };
    }
    if (!isOpResult.waitForSignal(queueItem.prevOpResult)) {
      return { handled };
    }
    handled = true;

    const isEnded =
      (await stateDriver.getOp({
        hashedOpId: queueItem.prevOpResult.opId.hashed,
        runId: queueItem.runId,
      })) !== undefined;
    const isTimeout = queueItem.prevOpResult.config.mode === OpMode.scheduled;
    if (isEnded && isTimeout) {
      // The waitForSignal is ended so we need to ignore the timeout queue item
      return { handled, allowExecution: false };
    }

    const waitingSignal = await stateDriver.waitingSignals.pop(
      queueItem.prevOpResult.config.options.signal
    );
    if (waitingSignal === null) {
      return { handled };
    }
    const opResult: OpResults["waitForSignal"] = {
      config: {
        code: StdOpCode.waitForSignal,
        options: waitingSignal.op.config.options,
        mode: OpMode.immediate,
      },
      opId: waitingSignal.op.opId,
      result: {
        status: "success",
        output: null,
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
        attempt: nextAttempt(op, queueItem),
        maxAttempts: queueItem.maxAttempts,
        prevOpResult: op,
        runId: queueItem.runId,
        workflowId: queueItem.workflowId,
      },
      time: Date.now() + op.config.options.timeout,
    });
    return true;
  },
};

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
      attempt: 1,
      runId: waitingSignal.runId,
      maxAttempts: workflow.maxAttempts ?? defaultMaxAttempts,
      workflowId: waitingSignal.workflowId,
    },
    time: Date.now(),
  });
  return waitingSignal.runId;
}

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
    config: {
      code: StdOpCode.waitForSignal,
      options: waitingSignal.op.config.options,
      mode: OpMode.immediate,
    },
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
