import { driver } from "./client";
import { workflow } from "./workflows";

async function main() {
  console.log(await driver.invoke(workflow, { name: "Alice" }));
}

void main();
