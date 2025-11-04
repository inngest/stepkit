# StepKit

StepKit is a framework for provider-agnostic workflows.

## Example

```ts
// Provider-agnostic package
import { StepKitClient, eventTrigger } from "@stepkit/core";

// Provider-specific package
import { InMemoryDriver } from "@stepkit/in-memory";

const client = new StepKitClient({ driver: new InMemoryDriver() });

const workflow = client.workflow(
  {
    id: "say-hi",

    // Static and runtime type safety for the input
    inputSchema: z.object({ name: z.string() }),
  },
  async (ctx, step) => {
    const randomNumber = await step.run("random-number", () => {
      return Math.floor(Math.random() * 100);
    });

    return `Hello ${ctx.input.name}! Your random number is ${randomNumber.toString()}.`;
  }
);

async function main() {
  console.log(await workflow.invoke({ name: "Alice" }));
}

void main();
```