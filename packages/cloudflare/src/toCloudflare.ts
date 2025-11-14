import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";

import { type Context, type Workflow } from "@stepkit/sdk-tools";

export function toCloudflare(
  workflow: Workflow<any, any>
): typeof WorkflowEntrypoint<any, any> {
  class WrappedWorkflow extends WorkflowEntrypoint {
    async run(event: WorkflowEvent<unknown>, step: WorkflowStep): Promise<any> {
      const ctx: Context = {
        runId: event.instanceId,
        input: {
          data: event.payload,
          ext: {},
          id: event.instanceId,
          name: "",
          time: event.timestamp,
          type: "event",
        },
        ext: {},
      };

      const stepKitStep = {
        ext: {},
        run: <T>(stepId: string, handler: () => T) => {
          return step.do(
            stepId,

            // @ts-expect-error - Is this fixable?
            handler
          ) as Promise<T>;
        },
        sleep: (stepId: string, duration: number) => {
          return step.sleep(stepId, duration);
        },
        sleepUntil: (stepId: string, wakeAt: Date) => {
          return step.sleepUntil(stepId, wakeAt);
        },
      };

      return workflow.handler(ctx, stepKitStep);
    }
  }

  return WrappedWorkflow;
}
