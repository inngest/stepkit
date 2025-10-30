export type MaybePromise<T> = T | Promise<T>;

export enum StepOpCode {
  StepPlanned = "StepPlanned",
  StepRun = "StepRun",
  StepError = "StepError",
  Sleep = "Sleep",
}

export interface StepOptions {
  id: string;
  name?: string;
}

export interface MemoizedOp {
  attempt: number;
  id: string;
  data?: unknown;
  error?: unknown;
  seen?: boolean;
  fulfilled?: boolean;
}

export interface OutgoingOp {
  id: string;
  op: StepOpCode;
  name?: string;
  displayName?: string;
  data?: unknown;
  error?: unknown;
  opts?: Record<string, unknown>;
}

export interface FoundStep {
  id: string;
  hashedId: string;
  op: StepOpCode;
  name?: string;
  displayName: string;
  opts?: Record<string, unknown>;
  fn?: () => MaybePromise<unknown>;
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  fulfilled: boolean;
  hasStepState: boolean;
  handled: boolean;
  handle: () => boolean;
}

export interface ExecutionResult {
  type: "function-resolved" | "function-rejected" | "step-ran" | "steps-found";
  data?: unknown;
  error?: unknown;
  step?: OutgoingOp;
  steps?: OutgoingOp[];
  ops?: Record<string, MemoizedOp>;
  canRetry?: boolean;
}

export interface WorkflowExecutionOptions<TInput = unknown> {
  workflowId: string;
  input: TInput;
  stepState: Record<string, MemoizedOp>;
  stepCompletionOrder: string[];
  requestedRunStep?: string;
  disableImmediateExecution?: boolean;
}

export interface StepTools {
  run: <T>(
    idOrOpts: string | StepOptions,
    fn: () => MaybePromise<T>,
  ) => Promise<T>;
  sleep: (idOrOpts: string | StepOptions, duration: number) => Promise<void>;
}

export interface WorkflowContext<TInput = unknown> {
  attempt: number;
  input: TInput;
  step: StepTools;
}

export type WorkflowHandler<TInput = unknown, TOutput = unknown> = (
  ctx: WorkflowContext<TInput>,
) => MaybePromise<TOutput>;
