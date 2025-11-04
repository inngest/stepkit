import { workflow } from "./workflows";

async function main() {
  console.log(await workflow.invoke({ name: "Alice" }));
}

void main();
