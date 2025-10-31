# @open-workflow/inngest

Inngest driver for the Open Workflow SDK. This driver offloads workflow orchestration to [Inngest](https://www.inngest.com/).

## Installation

```bash
npm install @open-workflow/inngest inngest
```

## Usage

The Inngest driver integrates Open Workflow with Inngest by wrapping workflow execution within Inngest functions. 

### Basic Example

```typescript
import { Inngest } from "inngest";
import { OWClient } from "@open-workflow/core";
import { InngestDriver } from "@open-workflow/inngest";

// Create an Inngest client
const inngest = new Inngest({ id: "my-app" });

// Create an Inngest function that uses the Open Workflow driver
export const workflowFunction = inngest.createFunction(
  { id: "my-workflow" },
  { event: "workflow/run" },
  async ({ step, runId }) => {
    // Create the Inngest driver with the step context
    const driver = new InngestDriver(step, runId);

    // Create the OWClient with the Inngest driver
    const client = new OWClient({ driver });

    // Define your workflow
    const workflow = client.workflow(
      { id: "my-workflow" },
      async ({ step }) => {
        const greeting = await step.run("get-greeting", async () => {
          return "Hello";
        });

        const name = await step.run("get-name", async () => {
          return "World";
        });

        return `${greeting}, ${name}!`;
      }
    );

    // Invoke the workflow
    return await workflow.invoke({});
  }
);
```

## How It Works

The `InngestDriver` wraps Open Workflow step execution within Inngest's step functions:

1. **State Management**: Instead of managing state locally, the driver delegates to Inngest's built-in step memoization
2. **Orchestration**: Inngest handles the execution loop, retries, and workflow orchestration
3. **Step Wrapping**: Each Open Workflow step is wrapped in an Inngest `step.run()` call

## Architecture

- **InngestDriver**: Extends `BaseExecutionDriver` and wraps step execution with Inngest's step API
- **InngestRunStateDriver**: Implements `RunStateDriver` interface, though state is primarily managed by Inngest

## Example Project

See the complete example in `examples/inngest` for a full working implementation with Express server integration.
