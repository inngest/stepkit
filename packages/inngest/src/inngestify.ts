import { Inngest, type ServeHandlerOptions } from "inngest";

import type { Context, ExtDefault, Step, Workflow } from "@stepkit/sdk-tools";

import {
  type InngestClient,
  type ReceivedEvent,
  type SentEvent,
  type StepExt,
} from "./client";

export function inngestify(
  client: InngestClient,
  workflows: Workflow<any, any, ExtDefault, ExtDefault, StepExt>[]
): ServeHandlerOptions {
  const inngest = new Inngest({ id: client.id });
  const functions = workflows.map((workflow) => {
    return inngest.createFunction(
      {
        id: workflow.id,
      },
      { event: "workflow/say-hi" },
      async (ctx) => {
        let time = new Date();
        if (ctx.event.ts !== undefined) {
          time = new Date(ctx.event.ts);
        }

        const workflowCtx: Context = {
          runId: ctx.runId,
          input: {
            ...ctx.event,
            id: ctx.event.id ?? "unknown",
            ext: {},
            time,
            type: "event",

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            data: ctx.event.data ?? {},
          },
          ext: {},
        };

        const workflowStep: Step<StepExt> = {
          ext: {
            sendEvent: async (stepId: string, event: SentEvent) => {
              return ctx.step.sendEvent(stepId, event);
            },
            waitForEvent: async (
              stepId: string,
              opts: {
                event: string;
                if?: string;
                timeout: number | string | Date;
              }
            ): Promise<ReceivedEvent | null> => {
              const event = await ctx.step.waitForEvent(stepId, opts);
              if (event === null) {
                return null;
              }
              return {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                data: event.data ?? {},
                id: event.id ?? "",
                name: event.name,
                ts: event.ts ?? 0,
                v: event.v ?? undefined,
              };
            },
          },
          run: <T>(stepId: string, handler: () => T) => {
            return ctx.step.run(stepId, handler) as Promise<T>;
          },
          sleep: (stepId: string, duration: number) => {
            return ctx.step.sleep(stepId, duration);
          },
          sleepUntil: async (stepId: string, wakeAt: Date) => {
            await ctx.step.sleep(stepId, wakeAt.getTime() - Date.now());
          },
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return workflow.handler(workflowCtx, workflowStep);
      }
    );
  });

  return {
    client: inngest,
    functions,
  };
}
