# Open Workflow

A lightweight, driver-based TypeScript SDK for building durable workflows with step execution and memoization.

## Features

- **Driver-Based Architecture**: Pluggable drivers for different execution environments
- **Step Memoization**: Automatic step result caching for resilient execution
- **Type-Safe API**: Fully typed workflow inputs, outputs, and step results


## Project Structure

```
open-workflow/
├── packages/
│   ├── core/                    # Core workflow execution engine
│   └── drivers/
│       └── in-memory/           # In-memory driver implementation
└── examples/
    └── basic/                   # Basic usage examples
```

## Quick Start

### Installation

```bash
pnpm install
pnpm -r build
```

### Basic Usage

```typescript
import { WorkflowClient } from "@open-workflow/core";
import { InMemoryDriver } from "@open-workflow/driver-in-memory";

//
// Create a workflow client with a driver
//
const client = new WorkflowClient(new InMemoryDriver());

//
// Define a workflow with typed input and output
//
const greetingWorkflow = client.workflow<{ name: string }, string>(
  { id: "greeting" },
  async ({ input, step }) => {
    const upperName = await step.run("uppercase", async () => {
      return input.name.toUpperCase();
    });

    const greeting = await step.run("create-greeting", async () => {
      return `Hello, ${upperName}!`;
    });

    return greeting;
  }
);

//
// Invoke the workflow
//
const result = await greetingWorkflow.invoke({ name: "Alice" });
console.log(result); // "Hello, ALICE!"
```

## Core Concepts

### Workflow

A workflow is a function that can contain multiple steps. Each step is memoized, meaning its result is cached and reused if the workflow is re-executed.

### Steps

Steps are the building blocks of workflows:

- **`step.run()`**: Execute a function and memoize its result
- **`step.sleep()`**: Pause execution for a specified duration

### Drivers

Drivers control how workflows are executed and how state is managed. The driver interface provides hooks for:

- `onStepsFound`: Called when new steps are discovered
- `onStepExecuted`: Called after a step completes
- `onWorkflowCompleted`: Called when the workflow finishes successfully
- `onWorkflowError`: Called when the workflow encounters an error

Drivers can choose to:
- Continue execution (run to completion)
- Interrupt execution (return intermediate results)
- Store state externally
- Implement custom retry logic

## Execution Model

The execution engine is based on a simplified version of Inngest's v2 execution logic:

1. **Discovery Phase**: The workflow function runs, discovering steps as they're encountered
2. **Memoization**: Steps with existing state are immediately resolved with cached results
3. **Execution**: Unfulfilled steps are executed when discovered
4. **Driver Control**: At each phase, the driver can decide whether to continue or interrupt

## Examples

See `examples/basic/src/index.ts` for complete working examples including:

- Simple step execution
- Multiple sequential steps
- Sleep/delay functionality

To run the examples:

```bash
cd examples/basic
pnpm dev
```

## Development

### Build all packages

```bash
pnpm -r build
```

### Watch mode

```bash
pnpm dev
```

## Architecture Notes

This SDK extracts the core step execution logic from Inngest's TypeScript SDK while:

- Removing Inngest-specific features (events, middleware, etc.)
- Simplifying the driver interface (no hooks for MVP)
- Maintaining the core memoization and checkpoint system
- Providing a clean, straightforward API surface

The execution flow uses an async generator-based checkpoint system that allows the driver to control execution flow at key points without complex callback chains.

## License

MIT
