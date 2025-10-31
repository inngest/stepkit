import type { GetStepTools } from "inngest";
import type { RunStateDriver, OpResult, Workflow } from "@open-workflow/core";
import { BaseExecutionDriver } from "@open-workflow/core";
import { StdContext, StdOpcode } from "@open-workflow/core";
import { createControlledPromise } from "@open-workflow/core";

//
// Since Inngest automatically manages state through step.run, this driver
// acts as a pass-through that doesn't need to persist state locally.
export class InngestRunStateDriver implements RunStateDriver {
  private ops: Map<string, OpResult>;
  private runId: string;

  constructor(runId: string) {
    this.ops = new Map();
    this.runId = runId;
  }

  private getKey({
    runId,
    hashedOpId,
  }: {
    runId: string;
    hashedOpId: string;
  }): string {
    return `${runId}:${hashedOpId}`;
  }

  getOp({
    runId,
    hashedOpId,
  }: {
    runId: string;
    hashedOpId: string;
  }): OpResult | undefined {
    const key = this.getKey({ runId, hashedOpId });
    return this.ops.get(key);
  }

  setOp(
    { runId, hashedOpId }: { runId: string; hashedOpId: string },
    op: OpResult
  ): void {
    const key = this.getKey({ runId, hashedOpId });
    this.ops.set(key, op);
  }
}

//
// InngestDriver offloads workflow orchestration to Inngest.
// It wraps Open Workflow step execution within Inngest step functions.
export class InngestDriver extends BaseExecutionDriver {
  private inngestStep: GetStepTools<any>;
  private runId: string;

  constructor(inngestStep: GetStepTools<any>, runId: string) {
    const stateDriver = new InngestRunStateDriver(runId);
    super(stateDriver);
    this.inngestStep = inngestStep;
    this.runId = runId;
  }

  //
  // Override getContext to wrap step.run calls with Inngest's step execution
  // Using arrow function to preserve 'this' binding
  getContext = (reportOp: <TOutput>(op: any) => Promise<TOutput>): StdContext => {
    return {
      step: {
        run: async <T>(
          stepId: string,
          handler: () => Promise<T>
        ): Promise<T> => {
          //
          // Wrap the Open Workflow step in an Inngest step.
          // Inngest handles memoization and state management automatically.
          return (await this.inngestStep.run(stepId, async () => {
            const output = await reportOp<T>({
              config: {
                code: StdOpcode.stepRun,
                options: { handler },
              },
              id: {
                hashed: stepId,
                id: stepId,
                index: 0,
              },
              promise: createControlledPromise<T>(),
            });
            return output;
          })) as T;
        },
        sleep: async (stepId: string, duration: number): Promise<void> => {
          await this.inngestStep.run(stepId, async () => {
            await reportOp({
              config: {
                code: StdOpcode.stepSleep,
                options: { wakeupAt: new Date(Date.now() + duration) },
              },
              id: { hashed: stepId, id: stepId, index: 0 },
              promise: createControlledPromise<any>(),
            });
            return null;
          });
        },
      },
    };
  };

  //
  // For Inngest, invoke runs the workflow once within an Inngest function context.
  // Inngest handles the orchestration loop automatically through step memoization.
  async invoke<TOutput>(
    workflow: Workflow<StdContext, TOutput>
  ): Promise<TOutput> {
    const ops = await this.execute(workflow);

    //
    // Find the workflow completion result
    const workflowOp = ops.find((op) => op.config.code === StdOpcode.workflow);

    if (workflowOp) {
      if (workflowOp.result.status === "success") {
        return workflowOp.result.output as TOutput;
      }
      throw workflowOp.result.error;
    }

    //
    // If no workflow result, we're still in progress
    // This shouldn't happen in practice since Inngest handles the orchestration
    throw new Error("Workflow did not complete");
  }
}
