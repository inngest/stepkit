import { client } from "./client";
import { workflow } from "./workflows";

async function main() {
  console.log(await client.invoke(workflow, { name: "Alice" }));
}

void main();
