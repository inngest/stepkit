import { driver } from "./client";
import { workflow } from "./workflows";

async function main() {
  driver.start();
  void workflow.start({ name: "Alice" });

  await new Promise((resolve) => setTimeout(resolve, 5000));
  driver.stop();
}

void main();
