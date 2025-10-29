import { client } from "./client";

export const workflow1 = client.workflow(
  { id: "workflow-1", trigger: { event: "my-event" } },
  async ({ step }) => {
    await step.sendEvent("my-event-2");
  }
);
