import { workflow1 } from "./workflows";

async function main() {
  const result = await workflow1.invoke({});

  // Print "Hello, Alice!"
  console.log(result);
}

main();
