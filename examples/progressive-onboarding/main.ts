import { client } from "./client";
import { progressiveOnboardingWorkflow } from "./workflows";

/**
 * Progressive Onboarding Demo
 *
 * This demo runs the progressive onboarding workflow for sample users.
 * The workflow demonstrates a realistic multi-day onboarding sequence
 * with conditional logic based on user behavior.
 *
 * Note: For demo purposes, we've shortened the time delays significantly.
 * In production, you would use actual multi-day delays.
 */

async function main() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║   Progressive Onboarding Drip Campaign Example         ║");
  console.log("║   Built with StepKit (In-Memory Driver)                ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  // Example user 1: New user
  const user1 = {
    userId: "user_001",
    email: "alice@example.com",
    userName: "Alice",
  };

  console.log("Starting onboarding workflow for Alice...\n");
  console.log("═════════════════════════════════════════════════════════\n");

  const result = await client.invoke(progressiveOnboardingWorkflow, user1);

  console.log("\n═════════════════════════════════════════════════════════");
  console.log("✨ Workflow execution complete!");
  console.log("═════════════════════════════════════════════════════════\n");

  console.log("Final Result:");
  console.log(JSON.stringify(result, null, 2));

  console.log("\n\n💡 Tip: Run this example multiple times to see different");
  console.log("   outcomes based on simulated user behavior!");
  console.log("\n💡 Try modifying the user data in main.ts to test");
  console.log("   different scenarios.");
}

void main();
