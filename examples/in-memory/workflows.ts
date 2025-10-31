import { client } from "./client";

export const workflow = client.workflow(
  { id: "my-workflow" },
  async ({ step }) => {
    console.log("workflow: top");

    const greeting = await step.run("get-greeting", async () => {
      console.log("get-greeting: executing");
      return "Hello";
    });

    const name = await step.run("get-name", async () => {
      console.log("get-name: executing");
      return "Alice";
    });

    console.log("workflow: bottom");

    return `${greeting}, ${name}!`;
  }
);
