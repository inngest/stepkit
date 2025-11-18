import type { StartData } from "@stepkit/sdk-tools";

import type { ExecQueueData, SortedQueue } from "./queue";
import type { LocalStateDriver } from "./stateDriver";

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startWorkflow({
  data,
  execQueue,
  maxAttempts,
  stateDriver,
  workflowId,
}: {
  data: unknown;
  execQueue: SortedQueue<ExecQueueData>;
  maxAttempts: number;
  stateDriver: LocalStateDriver;
  workflowId: string;
}): Promise<StartData> {
  const eventId = crypto.randomUUID();
  const runId = crypto.randomUUID();

  await stateDriver.addRun({
    ctx: {
      ext: {},
      input: {
        data,
        ext: {},
        id: eventId,
        name: workflowId,
        time: new Date(),
        type: "invoke",
      },
      runId,
    },
    result: undefined,
    maxAttempts,
    opAttempts: {},
    workflowId,
  });

  await execQueue.add({
    data: {
      attempt: 1,
      maxAttempts,
      runId,
      workflowId,
    },
    time: Date.now(),
  });

  return {
    eventId,
    runId,
  };
}
