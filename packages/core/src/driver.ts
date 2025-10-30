import type {
  ExecutionResult,
  FoundStep,
  MemoizedOp,
  OutgoingOp,
  WorkflowExecutionOptions,
} from "./types.js";

export enum FlowControl {
  //
  // Continue execution (memoization loop continues)
  Continue = "Continue",

  //
  // Interrupt execution and return result (stop memoization loop)
  Interrupt = "Interrupt",
}

export interface FlowControlResult {
  action: FlowControl;
  result?: ExecutionResult;
}

export interface WorkflowDriver {
  //
  // Called when steps are found during execution
  // Driver can decide to execute a step, save state, or interrupt
  onStepsFound(
    options: WorkflowExecutionOptions,
    steps: FoundStep[],
    state: Record<string, MemoizedOp>
  ): Promise<FlowControlResult>;

  //
  // Called when a step has been executed
  // Driver can save the result and decide whether to continue or interrupt
  onStepExecuted(
    options: WorkflowExecutionOptions,
    step: OutgoingOp,
    state: Record<string, MemoizedOp>
  ): Promise<FlowControlResult>;

  //
  // Called when the workflow function completes
  onWorkflowCompleted(
    options: WorkflowExecutionOptions,
    result: unknown
  ): Promise<ExecutionResult>;

  //
  // Called when the workflow function throws an error
  onWorkflowError(
    options: WorkflowExecutionOptions,
    error: unknown
  ): Promise<ExecutionResult>;
}
