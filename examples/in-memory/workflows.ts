import { client } from "./client";

export const workflow = client.workflow(
  { id: "my-workflow" },
  async (ctx, step) => {
    console.log(ctx.input);
    console.log("workflow: top");

    const greeting = await step.run("get-greeting", () => {
      console.log("get-greeting: executing");
      return "Hello";
    });

    const name = await step.run("get-name", () => {
      console.log("get-name: executing");
      return "Alice";
    });

    console.log("workflow: bottom");

    return `${greeting}, ${name}!`;
  }
);
