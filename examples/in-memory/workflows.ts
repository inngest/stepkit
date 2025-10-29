import { client } from "./client";

export const workflow1 = client.workflow(
  { id: "workflow-1", trigger: { event: "my-event" } },
  async ({ step }) => {
    const name = await step.run("get-name", async () => "Alice");

    return `Hello, ${name}!`;
  }
);
