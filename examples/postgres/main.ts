import { client } from "./client";
import { workflow } from "./workflows";

async function main() {
  console.log("Starting ProductionClient example...\n");

  // Initialize the client (runs migrations if needed)
  await client.start();
  console.log("✓ Client initialized and connected to database\n");

  // Run the workflow
  console.log("Running workflow...");
  await client.startWorkflow(workflow, { name: "Alice" });
  const result = await client.invoke(workflow, { name: "Alice" });
  console.log(result);
  console.log();

  // Clean up
  console.log("Shutting down...");
  client.stop();
  await client.close();
  console.log("✓ Client closed successfully");
}

void main().catch((error) => {
  console.error("Error running example:", error);
  process.exit(1);
});
