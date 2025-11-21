import type { Input, OpResults } from "@stepkit/sdk-tools";

export type EventQueueData = Input<any, "event">;

// Blindly discover new ops in the workflow
type ActionDiscover = {
  code: "discover";
};

type ActionInvokeWorkflowTimeout = {
  code: "invokeWorkflow.timeout";
  opResult: OpResults["invokeWorkflow"];
};

type ActionSleepWakeup = {
  code: "sleep.wakeup";
  opResult: OpResults["sleep"];
};

type ActionWaitForSignalTimeout = {
  code: "waitForSignal.timeout";
  opResult: OpResults["waitForSignal"];
};

export type ExecQueueData = {
  // Controls how the queue item is handled
  action:
    | ActionDiscover
    | ActionInvokeWorkflowTimeout
    | ActionSleepWakeup
    | ActionWaitForSignalTimeout;

  attempt: number;
  maxAttempts: number;
  runId: string;
  workflowId: string;
};

export type QueueItem<T> = {
  data: T;
  time: number;
};

export interface SortedQueue<T> {
  add(item: QueueItem<T>): Promise<void>;
  getNext(): Promise<QueueItem<T> | undefined>;
  handle(callback: (item: QueueItem<T>) => unknown): () => void;
}
