import { client } from "./client";

export const workflow = client.workflow(
  { id: "my-workflow" },
  async ({ runId,step }) => {
    console.log("workflow: top", runId);

    const greeting = await step.run("get-greeting", async () => {
      console.log("get-greeting: executing");
      return "Hello";
    });

    const name = await step.run("get-name", async () => {
      console.log("get-name: executing");
      return "Alice";
    });

    await step.sleepUntil("zzz", new Date(Date.now() + 1000));

    console.log("workflow: bottom");

    return `${greeting}, ${name}!`;
  }
);
