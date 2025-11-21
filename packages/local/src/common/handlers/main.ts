import { type OpResult, type Workflow } from "@stepkit/sdk-tools";

import type { ExecQueueData, SortedQueue } from "../queue";
import type { LocalStateDriver } from "../stateDriver";
import type { OpHandlers } from "./common";
import { defaultHandlers } from "./default";
import { invokeWorkflowHandlers } from "./invokeWorkflow";
import { runEndHandlers } from "./runEnd";
import { sleepHandlers } from "./sleep";
import { waitForSignalHandlers } from "./waitForSignal";

const handlers: OpHandlers[] = [
  runEndHandlers,
  invokeWorkflowHandlers,
  sleepHandlers,
  waitForSignalHandlers,
  defaultHandlers,
];

/**
 * Handle any pre-execution logic for execution queue items. Returns true if
 * execution should be allowed
 */
export async function execQueueItemPreExecution(opts: {
  queueItem: ExecQueueData;
  stateDriver: LocalStateDriver;
}): Promise<boolean> {
  for (const handler of handlers) {
    const result = await handler.execQueue(opts);
    if (result.handled) {
      return result.allowExecution ?? true;
    }
  }
  return true;
}

export async function handleOpResult(opts: {
  execQueue: SortedQueue<ExecQueueData>;
  op: OpResult;
  queueItem: ExecQueueData;
  stateDriver: LocalStateDriver;
  workflowId: string;
  workflows: Map<string, Workflow<any, any>>;
}): Promise<void> {
  for (const handler of handlers) {
    const handled = await handler.opResult(opts);
    if (handled) {
      return;
    }
  }
}
