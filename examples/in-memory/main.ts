import { client } from "./client";
import { workflow } from "./workflows";

async function main() {
  await client.startWorkflow(workflow, { name: "Alice" });
  console.log(await client.invoke(workflow, { name: "Alice" }));
  await client.stop();
}

void main();
