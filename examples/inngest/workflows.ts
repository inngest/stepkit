import { eventTrigger } from "@stepkit/core";

import { client } from "./client";

export const workflow = client.workflow(
  {
    id: "say-hi",
    triggers: [eventTrigger("event-1")],
  },
  async (ctx, step) => {
    const greeting = await step.run("get-greeting", () => {
      return "Hello";
    });

    const randomNumber = await step.run("random-number", () => {
      return Math.floor(Math.random() * 100);
    });

    console.log(ctx.input.data);

    const name =
      typeof ctx.input.data.name === "string" ? ctx.input.data.name : "Unknown";
    console.log(
      `${greeting} ${name}! Your random number is ${randomNumber.toString()}`
    );

    const [event] = await Promise.all([
      step.ext.waitForEvent("wait-for-event", {
        event: "yo",
        timeout: 1000,
      }),
      step.ext.sendEvent("send-event", {
        name: "yo",
      }),
    ]);
    if (event === null) {
      throw new Error("unreachable: no event");
    }
    console.log(`Waited for event: ${event.id}`);

    console.log(
      await step.invokeWorkflow("invoke-other-workflow", {
        timeout: 5000,
        workflow: otherWorkflow,
      })
    );

    return "Done";
  }
);

export const otherWorkflow = client.workflow(
  {
    id: "other-workflow",
  },
  async ({ input }) => {
    console.log("other workflow");
    console.log(input);
    return "Done";
  }
);
