import { Inngest, type ServeHandlerOptions } from "inngest";

import type { StepKitClient, Workflow } from "@stepkit/sdk-tools";

export function inngestify(
  client: StepKitClient,
  workflow: Workflow
): ServeHandlerOptions {
  const inngest = new Inngest({ id: client.id });
  const functions = inngest.createFunction(
    {
      id: workflow.id,
    },
    { event: "workflow/say-hi" },
    async (ctx) => {
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
          ext: {},
          run: <T>(stepId: string, handler: () => T) => {
            //
            // TODO: type return properly
            return ctx.step.run(stepId, handler) as Promise<T>;
          },
          sleep: (stepId: string, duration: number) => {
            return ctx.step.sleep(stepId, duration);
          },
        }
      );
    }
  );
  return {
    client: inngest,
    functions: [functions],
  };
}
