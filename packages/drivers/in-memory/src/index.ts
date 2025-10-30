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

type RunState = {
  attempt: number;
  steps: Record<string, MemoizedOp>;
};

//
// Simple in-memory driver that executes workflows to completion in one go
// Stores all state in memory and runs steps immediately when found
// For checkpoint/re-entry behavior (like Inngest), use CheckpointInMemoryDriver
//
export class InMemoryDriver implements WorkflowDriver {
  private state = new Map<string, RunState>();

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
    let runState = this.state.get(options.workflowId);
    if (!runState) {
      runState = {
        attempt: 0,
        steps: {},
      };
    }

    let stepState = runState.steps[step.id];
    if (!stepState) {
      stepState = {
        id: step.id,
        attempt: 0,
        seen: true,
      };
    }

    let runAttempt = runState.attempt;
    if ("data" in step) {
      stepState = {
        ...stepState,
        data: step.data,
        fulfilled: true,
      };
      runAttempt = 0;
    } else if ("error" in step) {
      // TODO: Use workflow options
      const maxAttempts = 1;

      if (stepState.attempt >= maxAttempts) {
        stepState = {
          ...stepState,
          error: step.error,
          fulfilled: false,
        };

        // Reset run attempt since we want all retries for function-level errors
        runAttempt = stepState.attempt;
      } else {
        stepState = {
          ...stepState,
          attempt: stepState.attempt + 1,
        };
        runAttempt += 1;
      }
    } else {
      throw new Error("Unreachable: step has no data or error");
    }

    //
    // Save step result to in-memory state
    runState = {
      ...runState,
      attempt: runAttempt,
      [step.id]: stepState,
    };

    this.state.set(options.workflowId, runState);

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
    const attempt = this.getRunAttempt(options.workflowId);
    if (attempt >= 2) {
      return {
        type: "function-rejected",
        error,
        canRetry: false,
      };
    } else {
      return {
        type: "function-rejected",
        error,
        canRetry: true,
      };
    }
  }

  getRunAttempt(workflowId: string): number {
    const runState = this.state.get(workflowId);
    if (!runState) {
      return 0;
    }
    return runState.attempt;
  }

  //
  // Clear state for a workflow
  clearState(workflowId: string): void {
    this.state.delete(workflowId);
  }
}

export { CheckpointInMemoryDriver } from "./checkpoint.js";
