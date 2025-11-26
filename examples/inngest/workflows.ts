// import { eventTrigger } from "@stepkit/core";
import { z } from "zod";
import { client } from "./client";

export const processOrder = client.workflow(
  {
    id: "process-order",
    
    // Type-safe inputs & runtime validation
    inputSchema: z.object({
      orderId: z.string(),
      items: z.array(z.string()),
      email: z.email(),
      amount: z.number(),
    }),
  },
  async ({ input }, step) => {
    // Step 1: Reserve inventory
    const inventory = await step.run("reserve-inventory", async () => {
      console.log(`Reserving items: ${input.data.items.join(", ")}`);
      
      // Simulate inventory check
      const available = input.data.items.every(() => Math.random() > 0.1);
      
      if (!available) {
        throw new Error("Item out of stock - will retry");
      }
      
      return { reserved: true, items: input.data.items };
    });

    // Step 2: Process payment
    const payment = await step.run("process-payment", async () => {
      console.log(`Processing payment of $${input.data.amount}`);
      
      // Simulate payment processing
      const paymentId = crypto.randomUUID();
      
      return {
        id: paymentId,
        amount: input.data.amount,
        status: "completed",
      };
    });

    // Step 3: Wait 30 seconds before confirmation
    // This doesn't consume any resources while waiting!
    await step.sleep("wait-before-confirm", 7000);

    // Step 4: Send confirmation email
    await step.run("send-confirmation", async () => {
      console.log(`Sending order confirmation to ${input.data.email}`);
      console.log(`Order ${input.data.orderId} completed!`);
      
      return { emailSent: true };
    });

    // Return the final result
    return {
      orderId: input.data.orderId,
      paymentId: payment.id,
      status: "completed",
      items: inventory.items,
    };
  }
);

// export const workflow = client.workflow(
//   {
//     id: "say-hi",
//     triggers: [eventTrigger("event-1")],
//   },
//   async (ctx, step) => {
//     const greeting = await step.run("get-greeting", () => {
//       return "Hello";
//     });

//     const randomNumber = await step.run("random-number", () => {
//       return Math.floor(Math.random() * 100);
//     });

//     console.log(ctx.input.data);

//     const name =
//       typeof ctx.input.data.name === "string" ? ctx.input.data.name : "Unknown";
//     console.log(
//       `${greeting} ${name}! Your random number is ${randomNumber.toString()}`
//     );

//     const [event] = await Promise.all([
//       step.ext.waitForEvent("wait-for-event", {
//         event: "yo",
//         timeout: 1000,
//       }),
//       step.ext.sendEvent("send-event", {
//         name: "yo",
//       }),
//     ]);
//     if (event === null) {
//       throw new Error("unreachable: no event");
//     }
//     console.log(`Waited for event: ${event.id}`);

//     console.log(
//       await step.invokeWorkflow("invoke-other-workflow", {
//         timeout: 5000,
//         workflow: otherWorkflow,
//       })
//     );

//     return "Done";
//   }
// );

// export const otherWorkflow = client.workflow(
//   {
//     id: "other-workflow",
//   },
//   async ({ input }) => {
//     console.log("other workflow");
//     console.log(input);
//     return "Done";
//   }
// );
