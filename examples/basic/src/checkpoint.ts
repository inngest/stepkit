import { WorkflowClient } from "@open-workflow/core";
import { CheckpointInMemoryDriver } from "@open-workflow/driver-in-memory";

//
// Create a workflow client with the CHECKPOINT driver
// This driver implements Inngest-style re-entry behavior
const driver = new CheckpointInMemoryDriver();
const client = new WorkflowClient(driver);

//
// Define a simple workflow to demonstrate re-entry
const greetingWorkflow = client.workflow<{ name: string }, string>(
  { id: "greeting-checkpoint" },
  async ({ input, step }) => {
    console.log("  → Starting workflow");

    const upperName = await step.run("uppercase", async () => {
      console.log("  → Running step: uppercase");
      return input.name.toUpperCase();
    });

    const greeting = await step.run("create-greeting", async () => {
      console.log("  → Running step: create-greeting");
      return `Hello, ${upperName}!`;
    });

    return greeting;
  },
);

//
// Run the workflow
async function main() {
  console.log("\n=== Checkpoint Driver (Inngest-style re-entry) ===\n");
  console.log("Notice how the workflow function is invoked multiple times:");
  console.log("- First invocation: discovers and executes 'uppercase'");
  console.log(
    "- Second invocation: memoizes 'uppercase', executes 'create-greeting'",
  );
  console.log("- Third invocation: memoizes both steps, completes\n");

  const result = await greetingWorkflow.invoke({ name: "Alice" });

  console.log("\nResult:", result);
  console.log("\n=== Expected Output Pattern ===");
  console.log("  → Starting workflow");
  console.log("  → Running step: uppercase");
  console.log("  → Starting workflow       (re-entry!)");
  console.log("  → Running step: create-greeting");
  console.log("  → Starting workflow       (re-entry!)");
  console.log("Result: Hello, ALICE!\n");
}

main().catch(console.error);
