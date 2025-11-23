import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";

import type {
  Context,
  InputDefault,
  SendSignalOpts,
  Step,
  WaitForSignalOpts,
  Workflow,
} from "@stepkit/sdk-tools";

/**
 * Turn a StepKit workflow into a wrapper around a Cloudflare workflow. This
 * will run as a normal Cloudflare Workflow.
 */
export function toCloudflare(
  workflow: Workflow<any, any>
): typeof WorkflowEntrypoint<any, any> {
  class CloudflareWorkflow extends WorkflowEntrypoint {
    async run(event: WorkflowEvent<unknown>, step: WorkflowStep): Promise<any> {
      const stepKitCtx: Context = {
        ext: {},
        input: {
          data: event.payload,
          ext: {},

          // TODO: Is this the correct id?
          id: event.instanceId,

          // TODO: Is there an event name?
          name: "",

          time: event.timestamp,
          type: "event",
        },

        // TODO: Is this the correct id?
        runId: event.instanceId,
      };

      const stepKitStep: Step = {
        ext: {},
        invokeWorkflow: async <TInput extends InputDefault, TOutput>(
          _stepId: string,
          _opts: {
            data?: TInput;
            timeout: number | Date;
            workflow: Workflow<TInput, TOutput>;
          }
        ) => {
          throw new Error("not implemented");
        },
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
        sendSignal: async (_stepId: string, _opts: SendSignalOpts) => {
          throw new Error("not implemented");
        },
        waitForSignal: async <T>(
          _stepId: string,
          _opts: WaitForSignalOpts<T>
        ) => {
          throw new Error("not implemented");
        },
      };

      return workflow.handler(stepKitCtx, stepKitStep);
    }
  }

  return CloudflareWorkflow;
}
