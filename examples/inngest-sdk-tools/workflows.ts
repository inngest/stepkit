import { client } from "./client";

export const workflow = client.workflow(
  { id: "my-workflow" },
  async (_, step) => {
    const greeting = await step.run("get-greeting", () => {
      return "Hello";
    });

    const name = await step.run("get-name", () => {
      return "Alice";
    });

    await step.ext.sleepUntil("zzz", new Date(Date.now() + 1000));

    return `${greeting}, ${name}!`;
  }
);
