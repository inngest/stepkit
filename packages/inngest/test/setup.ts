/* eslint-disable no-console */

import { spawn, type ChildProcess } from "child_process";

let devServerProcess: ChildProcess | null = null;

async function startDevServer(): Promise<void> {
  console.log("Starting Inngest Dev Server...");

  // Start the dev server process
  devServerProcess = spawn(
    "npx",
    [
      "--yes",
      "inngest-cli@latest",
      "dev",
      "--no-discovery",
      "--no-poll",
      "--retry-interval",
      "1",
    ],
    {
      // Capture output instead of inheriting to avoid hanging
      stdio: "pipe",
      // Create a new process group to ensure we can kill the process and its
      // children
      detached: false,
    }
  );

  // Handle process errors
  devServerProcess.on("error", (err) => {
    console.error("Failed to start Inngest Dev Server:", err);
    throw err;
  });

  // Wait for Dev Server to be ready
  const maxAttempts = 40;
  const intervalMs = 500;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch("http://0.0.0.0:8288");
      if (response.ok) {
        console.log("Inngest Dev Server is ready!");
        break;
      }
    } catch {
      // Server not ready yet, continue polling
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    attempts++;

    if (attempts >= maxAttempts) {
      throw new Error("Inngest Dev Server failed to start within 20 seconds");
    }
  }
}

async function stopDevServer(): Promise<void> {
  if (devServerProcess != null && !devServerProcess.killed) {
    console.log("Stopping Inngest Dev Server...");

    // Kill the process
    devServerProcess.kill("SIGTERM");

    // Wait for the process to exit
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        // Force kill if it hasn't exited
        if (devServerProcess != null && !devServerProcess.killed) {
          devServerProcess.kill("SIGKILL");
        }
        resolve();
      }, 2000);

      devServerProcess?.on("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    devServerProcess = null;
  }
}

/**
 * Global setup function called before all tests
 */
export async function setup() {
  await startDevServer();

  // Return teardown function
  return async (): Promise<void> => {
    await stopDevServer();
  };
}
