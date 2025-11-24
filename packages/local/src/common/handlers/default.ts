import type { ExecQueueData } from "../queue";
import { nextAttempt, type OpHandlers } from "./common";

export const defaultHandlers: OpHandlers = {
  execQueue: async () => {
    return { handled: false };
  },

  opResult: async ({ execQueue, op, queueItem }) => {
    let action: ExecQueueData["action"] = { code: "discover" };
    if (op.result.status === "plan") {
      action = {
        code: "targetOp",
        hashedOpId: op.opId.hashed,
      };
    }

    await execQueue.add({
      data: {
        action,
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
