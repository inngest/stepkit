import { z } from "zod";

import { client } from "./client";

export const workflow = client.workflow(
  {
    id: "say-hi",

    // Static and runtime type safety for the input
    inputSchema: z.object({ name: z.string() }),
  },
  async (ctx, step) => {
    const randomNumber = await step.run("random-number", () => {
      console.log("inside");
      return Math.floor(Math.random() * 100);
    });

    return `Hello ${ctx.input.data.name}! Your random number is ${randomNumber.toString()}.`;
  }
);
