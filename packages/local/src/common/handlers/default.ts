import { nextAttempt, type OpHandlers } from "./common";

export const defaultHandlers: OpHandlers = {
  execQueue: async () => {
    return { handled: false };
  },

  opResult: async ({ execQueue, op, queueItem }) => {
    await execQueue.add({
      data: {
        attempt: nextAttempt(op, queueItem),
        maxAttempts: queueItem.maxAttempts,
        prevOpResult: op,
        runId: queueItem.runId,
        workflowId: queueItem.workflowId,
      },
      time: Date.now(),
    });
    return true;
  },
};
