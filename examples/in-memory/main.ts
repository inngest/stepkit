import { InMemoryOrchestrator } from "@open-workflow/in-memory";
import { workflow } from "./workflows";

async function main() {
  const orc = new InMemoryOrchestrator();
  const output = await orc.invoke(workflow);
  console.log("output:", output);
}

main();
