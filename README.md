# StepKit

StepKit is a framework for provider-agnostic workflows.

## Example

```ts
// Provider-agnostic package
import { eventTrigger } from "@stepkit/core";

// Provider-specific package
import { InMemoryClient } from "@stepkit/local";
const client = new InMemoryClient();

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
  console.log(await client.invoke(workflow, { name: "Alice" }));
}

void main();
```

## What's in this repo?

See [CONTRIBUTING.md](CONTRIBUTING.md) for more details.
