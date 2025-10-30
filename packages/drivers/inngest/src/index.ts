import {
  type ExecutionResult,
  FlowControl,
  type FlowControlResult,
  type FoundStep,
  type MemoizedOp,
  type OutgoingOp,
  type WorkflowDriver,
  type WorkflowExecutionOptions,
  type Workflow,
  type WorkflowHandler,
} from "@open-workflow/core";
import { Inngest } from "inngest";
import type { InngestFunction } from "inngest";

export interface InngestDriverOptions {
  client: Inngest.Any;
  eventName?: string;
}

//
// Inngest driver that executes workflows using Inngest's cloud infrastructure
// Maps our workflow model to Inngest functions and steps
//
export class InngestDriver implements WorkflowDriver {
  private client: Inngest.Any;
  private eventName: string;
  private functions: Map<string, InngestFunction.Any> = new Map();
  private workflows: Map<string, Workflow<any, any>> = new Map();

  constructor(options: InngestDriverOptions) {
    this.client = options.client;
    this.eventName = options.eventName || "workflow/invoke";
  }

  //
  // Register a workflow and create a corresponding Inngest function
  //
  registerWorkflow<TInput, TOutput>(
    workflow: Workflow<TInput, TOutput>,
  ): InngestFunction.Any {
    const config = workflow.config;

    //
    // Create an Inngest function that wraps our workflow
    //
    const inngestFn = this.client.createFunction(
      {
        id: config.id,
        name: config.id,
        retries: 0,
      },
      { event: this.eventName },
      async ({ event, step }: any) => {
        //
        // Extract the workflow input from the event
        //
        // const workflowId = event.data?.workflowId;
        // if (workflowId !== config.id) {
        //   return;
        // }

        const input = event.data?.input as TInput;

        //
        // Create a step tools wrapper that delegates to Inngest's step
        //
        const workflowHandler: WorkflowHandler<TInput, TOutput> = async (
          _ctx,
        ) => {
          //
          // We need to reconstruct the handler with Inngest's step tools
          //
          const inngestStepTools = {
            run: async <T>(
              idOrOpts: string | { id: string },
              fn: () => Promise<T>,
            ): Promise<T> => {
              const id = typeof idOrOpts === "string" ? idOrOpts : idOrOpts.id;
              return await step.run(id, fn);
            },
            sleep: async (
              idOrOpts: string | { id: string },
              duration: number,
            ): Promise<void> => {
              const id = typeof idOrOpts === "string" ? idOrOpts : idOrOpts.id;
              await step.sleep(id, duration);
            },
          };

          return await (workflow as any).handler({
            input: input,
            step: inngestStepTools,
          });
        };

        const result = await workflowHandler({ input, step: {} as any });
        return result;
      },
    );

    this.functions.set(config.id, inngestFn);
    this.workflows.set(config.id, workflow);

    return inngestFn;
  }

  //
  // Get all registered Inngest functions (for serving)
  //
  getFunctions(): InngestFunction.Any[] {
    return Array.from(this.functions.values());
  }

  //
  // Trigger a workflow by sending an Inngest event
  //
  async invokeWorkflow<TInput>(
    workflowId: string,
    input: TInput,
  ): Promise<{ id: string }> {
    console.log("invokeWorkflow");
    const result = await this.client.send({
      name: this.eventName,
      data: {
        workflowId,
        input,
      },
    });

    return { id: result.ids[0] || "unknown" };
  }

  //
  // Driver interface methods - these won't be called in Inngest mode
  // since Inngest handles execution internally
  //

  async onStepsFound(
    _options: WorkflowExecutionOptions,
    _steps: FoundStep[],
    _state: Record<string, MemoizedOp>,
  ): Promise<FlowControlResult> {
    console.log("onStepsFound");
    return {
      action: FlowControl.Continue,
    };
  }

  async onStepExecuted(
    _options: WorkflowExecutionOptions,
    _step: OutgoingOp,
    _state: Record<string, MemoizedOp>,
  ): Promise<FlowControlResult> {
    return {
      action: FlowControl.Continue,
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
}
