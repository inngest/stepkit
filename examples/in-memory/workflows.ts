import { eventTrigger } from "@stepkit/core";
import { z } from "zod";

import { client } from "./client";

export const workflow = client.workflow(
  {
    id: "say-hi",
    //
    // Schema is now inferred from the trigger event
    triggers: [eventTrigger("say-hi", z.object({ name: z.string() }))],
  },
  async (ctx, step) => {
    console.log(ctx.input);
    const randomNumber = await step.run("random-number", () => {
      return Math.floor(Math.random() * 100);
    });
    //
    // ctx.input.data.name is now properly typed as string!
    return `Hello ${ctx.input.data.name}! Your random number is ${randomNumber.toString()}.`;
  }
);
