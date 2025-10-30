import {
  type ExecutionResult,
  FlowControl,
  type FlowControlResult,
  type FoundStep,
  type MemoizedOp,
  type OutgoingOp,
  type WorkflowDriver,
  type WorkflowExecutionOptions,
} from "@open-workflow/core";

//
// Checkpoint-style in-memory driver that mimics Inngest's re-entry model
// Executes one step at a time, re-invoking the workflow for each step
export class CheckpointInMemoryDriver implements WorkflowDriver {
  private state = new Map<string, Record<string, MemoizedOp>>();

  async onStepsFound(
    _options: WorkflowExecutionOptions,
    _steps: FoundStep[],
    _state: Record<string, MemoizedOp>,
  ): Promise<FlowControlResult> {
    //
    // Don't interrupt on finding steps - let execution continue to try to run one
    return {
      action: FlowControl.Continue,
    };
  }

  async onStepExecuted(
    options: WorkflowExecutionOptions,
    step: OutgoingOp,
    state: Record<string, MemoizedOp>,
  ): Promise<FlowControlResult> {
    //
    // Save step result to state
    const workflowState = this.state.get(options.workflowId) || {};

    workflowState[step.id] = {
      id: step.id,
      data: step.data,
      error: step.error,
      fulfilled: true,
      seen: true,
    };

    this.state.set(options.workflowId, workflowState);

    //
    // CRITICAL: Interrupt execution after each step
    return {
      action: FlowControl.Interrupt,
      result: {
        type: "step-ran",
        step,
        ops: state,
      },
    };
  }

  async onWorkflowCompleted(
    _options: WorkflowExecutionOptions,
    result: unknown,
  ): Promise<ExecutionResult> {
    return {
      type: "function-resolved",
      data: result,
    };
  }

  async onWorkflowError(
    _options: WorkflowExecutionOptions,
    error: unknown,
  ): Promise<ExecutionResult> {
    return {
      type: "function-rejected",
      error,
    };
  }

  //
  // Get stored state for a workflow
  getState(workflowId: string): Record<string, MemoizedOp> | undefined {
    return this.state.get(workflowId);
  }

  //
  // Clear state for a workflow
  clearState(workflowId: string): void {
    this.state.delete(workflowId);
  }
}
