import { nextAttempt, type OpHandlers } from "./common";

export const defaultHandlers: OpHandlers = {
  execQueue: async () => {
    return { handled: false };
  },

  opResult: async ({ execQueue, op, queueItem }) => {
    await execQueue.add({
      data: {
        action: { code: "discover" },
        attempt: nextAttempt(op, queueItem),
        maxAttempts: queueItem.maxAttempts,
        runId: queueItem.runId,
        workflowId: queueItem.workflowId,
      },
      time: Date.now(),
    });
    return true;
  },
};
