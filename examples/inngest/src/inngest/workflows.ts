import { WorkflowClient } from "@open-workflow/core";
import { InngestDriver } from "@open-workflow/driver-inngest";
import { inngest } from "./client.js";

//
// Create a workflow client with the Inngest driver
const driver = new InngestDriver({ client: inngest });
const client = new WorkflowClient(driver);

//
// Define workflows
export const greetingWorkflow = client.workflow<{ name: string }, string>(
  { id: "greeting-workflow" },
  async ({ step }) => {
    console.log("workflow:top");
    const greeting = await step.run("get-greeting", async () => {
      console.log("  → Running step: get-greeting");
      // return input.name.toUpperCase();
      return "Hello";
    });

    const name = await step.run("get-name", async () => {
      console.log("  → Running step: get-name");
      return "Alice";
    });

    return `${greeting}, ${name}!`;
  },
);

// export const calculationWorkflow = client.workflow<
//   { x: number; y: number },
//   { sum: number; product: number; doubled: number }
// >({ id: "calculation-workflow" }, async ({ input, step }) => {
//   const sum = await step.run("add", async () => {
//     console.log("  → Running step: add");
//     return input.x + input.y;
//   });

//   const product = await step.run("multiply", async () => {
//     console.log("  → Running step: multiply");
//     return input.x * input.y;
//   });

//   const doubled = await step.run("double-sum", async () => {
//     console.log("  → Running step: double-sum");
//     return sum * 2;
//   });

//   return { sum, product, doubled };
// });

export const functions = [
  driver.registerWorkflow(greetingWorkflow),
  // driver.registerWorkflow(calculationWorkflow),
];

export { driver };
