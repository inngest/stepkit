import { eventTrigger } from "@stepkit/core";
import { z } from "zod";

import { client } from "./client";

//
// Pattern 1: Define schema via trigger event
// Use this for event-driven workflows
const userSignupEvent = eventTrigger(
  "user.signup",
  z.object({ email: z.string() })
);

const eventDrivenWorkflow = client.workflow(
  {
    id: "event-driven-fn",
    triggers: [userSignupEvent],
  },
  async (ctx, _step) => {
    //
    // Type safe! ctx.input.data.email is string
    console.log(`User signed up: ${ctx.input.data.email}`);
    return ctx.input.data.email;
  }
);

//
// Pattern 2: Define schema on workflow
// Use this for invoke-only workflows
const invokeOnlyWorkflow = client.workflow(
  {
    id: "invoke-only-fn",
    inputSchema: z.object({ name: z.string() }),
  },
  async (ctx, _step) => {
    //
    // Type safe! ctx.input.data.name is string
    console.log(`Processing: ${ctx.input.data.name}`);
    return ctx.input.data.name;
  }
);

export { eventDrivenWorkflow, invokeOnlyWorkflow };
