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
  // This will run the workflow to completion in-memory
  //
  async invoke(input: TInput): Promise<TOutput> {
    const options: WorkflowExecutionOptions<TInput> = {
      workflowId: this.config.id,
      input,
      stepState: {},
      stepCompletionOrder: [],
      disableImmediateExecution: false,
    };

    const executor = new WorkflowExecutor(options, this.handler, this.driver);
    const result = await executor.start();

    if (result.type === "function-resolved") {
      return result.data as TOutput;
    } else if (result.type === "function-rejected") {
      throw result.error;
    }

    throw new Error(`Unexpected execution result type: ${result.type}`);
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
