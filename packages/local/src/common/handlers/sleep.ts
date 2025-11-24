import { isOpResult } from "@stepkit/sdk-tools";

import { nextAttempt, type OpHandlers } from "./common";

export const sleepHandlers: OpHandlers = {
  execQueue: async ({ queueItem, stateDriver }) => {
    let handled = false;
    const { action } = queueItem;
    if (action.code !== "sleep.wakeup") {
      return { handled };
    }
    handled = true;

    await stateDriver.setOp(
      {
        runId: queueItem.runId,
        hashedOpId: action.opResult.opId.hashed,
      },
      {
        ...action.opResult,
        result: {
          status: "success",
          output: null,
        },
      }
    );

    return { handled };
  },

  opResult: async ({ execQueue, op, queueItem }) => {
    let handled = false;
    if (!isOpResult.sleep(op)) {
      return handled;
    }
    handled = true;

    await execQueue.add({
      data: {
        action: {
          code: "sleep.wakeup",
          opResult: op,
        },
        attempt: nextAttempt(op, queueItem),
        maxAttempts: queueItem.maxAttempts,
        runId: queueItem.runId,
        workflowId: queueItem.workflowId,
      },
      time: op.config.options.wakeAt,
    });
    return true;
  },
};
