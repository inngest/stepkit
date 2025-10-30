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
// Simple in-memory driver that executes workflows to completion
// Stores all state in memory and runs steps immediately when found
export class InMemoryDriver implements WorkflowDriver {
  private state = new Map<string, Record<string, MemoizedOp>>();

  async onStepsFound(
    options: WorkflowExecutionOptions,
    steps: FoundStep[],
    state: Record<string, MemoizedOp>
  ): Promise<FlowControlResult> {
    //
    // For in-memory execution, we just continue - steps will be executed
    // immediately by the executor
    return {
      action: FlowControl.Continue,
    };
  }

  async onStepExecuted(
    options: WorkflowExecutionOptions,
    step: OutgoingOp,
    state: Record<string, MemoizedOp>
  ): Promise<FlowControlResult> {
    //
    // Save step result to in-memory state
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
    // Continue execution - in-memory driver runs to completion
    return {
      action: FlowControl.Continue,
    };
  }

  async onWorkflowCompleted(
    options: WorkflowExecutionOptions,
    result: unknown
  ): Promise<ExecutionResult> {
    return {
      type: "function-resolved",
      data: result,
    };
  }

  async onWorkflowError(
    options: WorkflowExecutionOptions,
    error: unknown
  ): Promise<ExecutionResult> {
    return {
      type: "function-rejected",
      error,
    };
  }

  //
  // Get stored state for a workflow (useful for debugging)
  getState(workflowId: string): Record<string, MemoizedOp> | undefined {
    return this.state.get(workflowId);
  }

  //
  // Clear state for a workflow
  clearState(workflowId: string): void {
    this.state.delete(workflowId);
  }
}
