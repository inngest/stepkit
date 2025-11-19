import { StdOpCode, type OpResult, type Workflow } from "@stepkit/sdk-tools";

import type { ExecQueueData, SortedQueue } from "../queue";
import type { LocalStateDriver } from "../stateDriver";

export type OpResultHandler = (opts: {
  execQueue: SortedQueue<ExecQueueData>;
  op: OpResult;
  queueItem: ExecQueueData;
  stateDriver: LocalStateDriver;
  workflows: Map<string, Workflow<any, any>>;
}) => Promise<boolean>;

export type ExecQueueHandler = (opts: {
  queueItem: ExecQueueData;
  stateDriver: LocalStateDriver;
}) => Promise<{ handled: boolean; allowExecution?: boolean }>;

export type OpHandlers = {
  execQueue: ExecQueueHandler;
  opResult: OpResultHandler;
};

/**
 * Determines the attempt number for the next execution queue item
 */
export function nextAttempt(op: OpResult, exec: ExecQueueData): number {
  if (op.result.status !== "error") {
    // Success, so reset attempt
    return 1;
  }

  const exhaustedAttempts = exec.attempt >= exec.maxAttempts;
  if (exhaustedAttempts && op.config.code !== StdOpCode.workflow) {
    // Step-level error with no remaining attempts. But we need to reset the
    // attempt since the error needs to be thrown at the workflow level
    return 1;
  }

  // Next attempt
  return exec.attempt + 1;
}
