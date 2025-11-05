import express from "express";
import { Inngest } from "inngest";
import { serve } from "inngest/express";

import { StepKitClient, type Workflow } from "@stepkit/core";

import { client } from "./client";
import { workflow } from "./workflows";

const ingestify = (client: StepKitClient, workflow: Workflow) => {
  const inngest = new Inngest({ id: client.id });
  const functions = inngest.createFunction(
    {
      id: workflow.id,
    },
    { event: "myEvent" },
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
            data: ctx.event.data ?? {},
          },
          ext: {},
        },
        {
          ext: {},
          run: <T>(stepId: string, handler: () => T) => {
            return ctx.step.run(stepId, handler) as Promise<T>;
          },
          sleep: (stepId: string, duration: number) => {
            return ctx.step.sleep(stepId, duration) as Promise<void>;
          },
        }
      );
    }
  );
  return {
    client: inngest,
    functions: [functions],
  };
};

const app = express();

app.use(express.json());

app.use("/api/inngest", serve(ingestify(client, workflow)));

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(
    `Inngest endpoint available at http://localhost:${PORT}/api/inngest`
  );
});
