import { workflow } from "./workflows";

async function main() {
  const output = await workflow.invoke({});
  console.log("output:", output);
}

main();
