import { isOpResult, OpMode } from "@stepkit/sdk-tools";

import { nextAttempt, type OpHandlers } from "./common";

export const sleepHandlers: OpHandlers = {
  execQueue: async ({ queueItem, stateDriver }): Promise<boolean> => {
    let handled = false;
    if (queueItem.prevOpResult === undefined) {
      return handled;
    }
    if (!isOpResult.sleep(queueItem.prevOpResult)) {
      return handled;
    }
    handled = true;

    const opResult = {
      ...queueItem.prevOpResult,
      config: {
        ...queueItem.prevOpResult.config,
        mode: OpMode.immediate,
      },
    };

    await stateDriver.setOp(
      {
        runId: queueItem.runId,
        hashedOpId: opResult.opId.hashed,
      },
      opResult
    );

    return handled;
  },

  opResult: async ({ execQueue, op, queueItem }): Promise<boolean> => {
    let handled = false;
    if (!isOpResult.sleep(op)) {
      return handled;
    }
    handled = true;

    await execQueue.add({
      data: {
        attempt: nextAttempt(op, queueItem),
        maxAttempts: queueItem.maxAttempts,
        prevOpResult: op,
        runId: queueItem.runId,
        workflowId: queueItem.workflowId,
      },
      time: op.config.options.wakeAt,
    });
    return true;
  },
};
