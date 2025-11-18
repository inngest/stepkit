import { nextAttempt, type OpHandlers } from "./common";

export const defaultHandlers: OpHandlers = {
  execQueue: async (): Promise<boolean> => {
    return false;
  },

  opResult: async ({ execQueue, op, queueItem }): Promise<boolean> => {
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
