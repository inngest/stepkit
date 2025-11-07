import { z } from "zod";

import { client } from "./client";

export const workflow = client.workflow(
  {
    id: "say-hi",

    // Static and runtime type safety for the input
    inputSchema: z.object({ name: z.string() }),
  },
  async (ctx, step) => {
    console.log(ctx.input);
    const randomNumber = await step.run("random-number", () => {
      return Math.floor(Math.random() * 100);
    });

    return `Hello ${ctx.input.name}! Your random number is ${randomNumber.toString()}.`;
  }
);
