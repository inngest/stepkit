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
// Simple in-memory driver that executes workflows to completion in one go
// Stores all state in memory and runs steps immediately when found
// For checkpoint/re-entry behavior (like Inngest), use CheckpointInMemoryDriver
//
export class InMemoryDriver implements WorkflowDriver {
  private state = new Map<string, Record<string, MemoizedOp>>();

  async onStepsFound(
    _options: WorkflowExecutionOptions,
    _steps: FoundStep[],
    _state: Record<string, MemoizedOp>,
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
    _state: Record<string, MemoizedOp>,
  ): Promise<FlowControlResult> {
    let workflowState = this.state.get(options.workflowId);
    if (!workflowState) {
      workflowState = {};
    }

    let stepState = workflowState[step.id];
    if (!stepState) {
      stepState = {
        id: step.id,
        attempt: 0,
        seen: true,
      };
    }

    if ("data" in step) {
      stepState = {
        ...stepState,
        data: step.data,
        fulfilled: true,
      };
    } else if ("error" in step) {
      // TODO: Use workflow options
      const maxAttempts = 1;

      if (stepState.attempt >= maxAttempts) {
        stepState = {
          ...stepState,
          error: step.error,
          fulfilled: false,
        };
      } else {
        stepState = {
          ...stepState,
          attempt: stepState.attempt + 1,
        };
      }
    } else {
      throw new Error("Unreachable: step has no data or error");
    }

    //
    // Save step result to in-memory state
    workflowState = {
      ...workflowState,
      [step.id]: stepState,
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
    result: unknown,
  ): Promise<ExecutionResult> {
    return {
      type: "function-resolved",
      data: result,
    };
  }

  async onWorkflowError(
    options: WorkflowExecutionOptions,
    error: unknown,
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

export { CheckpointInMemoryDriver } from "./checkpoint.js";
