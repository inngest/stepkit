import { client } from "./client";

export const workflow = client.workflow(
  {
    id: "say-hi",
  },
  async (ctx, step) => {
    const greeting = await step.run("get-greeting", () => {
      console.log("get-greeting: executing");
      return "Hello";
    });

    const randomNumber = await step.run("random-number", () => {
      console.log("random-number: executing");
      return Math.floor(Math.random() * 100);
    });

    await step.sleep("short-pause", 1000);

    const message = `${greeting} ${ctx.input.data.name}! Your random number is ${randomNumber.toString()}.`;
    console.log("workflow result:", message);
    return message;
  }
);
