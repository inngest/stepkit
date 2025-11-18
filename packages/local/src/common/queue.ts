import type { Input, OpResult } from "@stepkit/sdk-tools";

export type EventQueueData = Input<any, "event">;

export type ExecQueueData = {
  attempt: number;
  maxAttempts: number;

  // OpResult that preceeded this queue item. For example, when a `step.run`
  // completes then we schedule a new queue item for the next execution
  prevOpResult?: OpResult;

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
