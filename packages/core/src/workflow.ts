import type {
  ExecutionResult,
  WorkflowExecutionOptions,
  WorkflowHandler,
} from "./types.js";
import type { WorkflowDriver } from "./driver.js";
import { WorkflowExecutor } from "./executor.js";

export interface WorkflowConfig {
  id: string;
}

export class Workflow<TInput = unknown, TOutput = unknown> {
  public readonly config: WorkflowConfig;
  private handler: WorkflowHandler<TInput, TOutput>;
  private driver: WorkflowDriver;

  constructor(
    config: WorkflowConfig,
    handler: WorkflowHandler<TInput, TOutput>,
    driver: WorkflowDriver,
  ) {
    this.config = config;
    this.handler = handler;
    this.driver = driver;
  }

  //
  // Invoke the workflow with the given input
  // Implements the re-entry model: runs the workflow multiple times,
  // executing one step per invocation, until completion
  async invoke(input: TInput): Promise<TOutput> {
    const stepState: Record<string, any> = {};
    const stepCompletionOrder: string[] = [];

    let i = 0;
    //
    // Re-entry loop: keep invoking the workflow until it completes
    // eslint-disable-next-line no-constant-condition
    while (true) {
      i++;
      if (i > 5) {
        // TEMPORARY
        break;
      }

      console.log("iteration");
      const options: WorkflowExecutionOptions<TInput> = {
        workflowId: this.config.id,
        input,
        stepState,
        stepCompletionOrder,
        disableImmediateExecution: false,
      };

      const executor = new WorkflowExecutor(options, this.handler, this.driver);
      const result = await executor.start();

      //
      // Workflow completed successfully
      if (result.type === "function-resolved") {
        return result.data as TOutput;
      }

      //
      // Workflow threw an error
      if (result.type === "function-rejected") {
        if (result.canRetry) {
          continue;
        }
        throw result.error;
      }

      //
      // A step was executed - add its result to state and re-invoke
      if (result.type === "step-ran" && result.step) {
        const stepId = result.step.id;

        //
        // Update step state with the result
        stepState[stepId] = {
          id: stepId,
          data: result.step.data,
          error: result.step.error,
          fulfilled: true,
          seen: true,
        };

        //
        // Track completion order
        //
        if (!stepCompletionOrder.includes(stepId)) {
          stepCompletionOrder.push(stepId);
        }

        //
        // Re-invoke the workflow from the beginning with updated state
        continue;
      }

      //
      // Steps found but not executed - this shouldn't happen in checkpoint mode
      if (result.type === "steps-found") {
        throw new Error(
          "Driver returned steps-found without executing. This indicates a driver misconfiguration.",
        );
      }

      throw new Error(`Unexpected execution result type: ${result.type}`);
    }
  }

  //
  // Execute the workflow incrementally, used by drivers that need step-by-step execution
  async execute(
    options: Partial<WorkflowExecutionOptions<TInput>>,
  ): Promise<ExecutionResult> {
    if (!options.input) {
      throw new Error("Input is required for workflow execution");
    }

    const executionOptions: WorkflowExecutionOptions<TInput> = {
      workflowId: this.config.id,
      input: options.input,
      stepState: options.stepState || {},
      stepCompletionOrder: options.stepCompletionOrder || [],
      requestedRunStep: options.requestedRunStep,
      disableImmediateExecution: options.disableImmediateExecution ?? false,
    };

    const executor = new WorkflowExecutor(
      executionOptions,
      this.handler,
      this.driver,
    );
    return await executor.start();
  }
}
