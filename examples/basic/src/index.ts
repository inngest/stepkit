import { WorkflowClient } from "@open-workflow/core";
import { InMemoryDriver } from "@open-workflow/driver-in-memory";

const client = new WorkflowClient(new InMemoryDriver());

const greetingWorkflow = client.workflow<{ name: string }, string>(
  { id: "greeting" },
  async ({ input, step }) => {
    //
    // Step 1: Transform the name to uppercase
    const upperName = await step.run("uppercase", async () => {
      console.log("  → Running step: uppercase");
      return input.name.toUpperCase();
    });

    //
    // Step 2: Create greeting message
    const greeting = await step.run("create-greeting", async () => {
      console.log("  → Running step: create-greeting");
      return `Hello, ${upperName}!`;
    });

    return greeting;
  },
);

//
// Define a workflow with multiple steps
const calculationWorkflow = client.workflow<
  { x: number; y: number },
  { sum: number; product: number; doubled: number }
>({ id: "calculation" }, async ({ input, step }) => {
  const sum = await step.run("add", async () => {
    console.log("  → Running step: add");
    return input.x + input.y;
  });

  const product = await step.run("multiply", async () => {
    console.log("  → Running step: multiply");
    return input.x * input.y;
  });

  const doubled = await step.run("double-sum", async () => {
    console.log("  → Running step: double-sum");
    return sum * 2;
  });

  return { sum, product, doubled };
});

//
// Define a workflow with sleep
const delayedWorkflow = client.workflow<{ message: string }, string>(
  { id: "delayed" },
  async ({ input, step }) => {
    console.log("  → Starting workflow");

    await step.sleep("initial-delay", 100);
    console.log("  → After first delay");

    const result = await step.run("process", async () => {
      console.log("  → Running step: process");
      return `Processed: ${input.message}`;
    });

    await step.sleep("final-delay", 100);
    console.log("  → After final delay");

    return result;
  },
);

//
// Run the examples
async function main() {
  console.log("\n=== Example 1: Simple Greeting Workflow ===");
  const result1 = await greetingWorkflow.invoke({ name: "Alice" });
  console.log("Result:", result1);

  console.log("\n=== Example 2: Calculation Workflow ===");
  const result2 = await calculationWorkflow.invoke({ x: 5, y: 3 });
  console.log("Result:", result2);

  console.log("\n=== Example 3: Delayed Workflow ===");
  const result3 = await delayedWorkflow.invoke({ message: "Hello World" });
  console.log("Result:", result3);

  console.log("\n=== All workflows completed successfully! ===\n");
}

main().catch(console.error);
