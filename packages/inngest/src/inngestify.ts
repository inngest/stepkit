import { Inngest, type ServeHandlerOptions } from "inngest";

import type { ExtDefault, Workflow } from "@stepkit/sdk-tools";

import { type InngestClient, type StepExt } from "./client";

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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return workflow.handler(
          {
            runId: ctx.runId,
            input: {
              ...ctx.event,
              id: ctx.event.id ?? crypto.randomUUID(),
              ext: {},
              time: new Date(),
              type: "invoke",

              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              data: ctx.event.data,
            },
            ext: {},
          },
          {
            ext: {
              sleepUntil: async (stepId: string, wakeupAt: Date) => {
                await ctx.step.sleep(stepId, wakeupAt.getTime() - Date.now());
              },
            },
            run: <T>(stepId: string, handler: () => T) => {
              return ctx.step.run(stepId, handler) as Promise<T>;
            },
            sleep: (stepId: string, duration: number) => {
              return ctx.step.sleep(stepId, duration);
            },
          }
        );
      }
    );
  });

  return {
    client: inngest,
    functions,
  };
}
