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
│       ├── in-memory/           # In-memory driver implementation
│       └── inngest/             # Inngest cloud driver
└── examples/
    ├── basic/                   # Basic in-memory examples
    └── inngest/                 # Inngest integration example
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
  },
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

### Available Drivers

- **InMemoryDriver** (`@open-workflow/driver-in-memory`): Runs workflows to completion in memory. Best for testing and simple use cases.
- **InngestDriver** (`@open-workflow/driver-inngest`): Executes workflows using Inngest's cloud infrastructure with durability, observability, and automatic retries.

## Execution Model

The execution engine is based on a simplified version of Inngest's v2 execution logic:

1. **Discovery Phase**: The workflow function runs, discovering steps as they're encountered
2. **Memoization**: Steps with existing state are immediately resolved with cached results
3. **Execution**: Unfulfilled steps are executed when discovered
4. **Driver Control**: At each phase, the driver can decide whether to continue or interrupt

## Examples

### In-Memory Example

See `examples/basic/` for a complete in-memory example:

- Simple step execution
- Multiple sequential steps
- Sleep/delay functionality

```bash
cd examples/basic
pnpm dev
```

### Inngest Example

See `examples/inngest/` for a complete Inngest cloud example:

- Durable workflow execution
- Step memoization with Inngest
- Event-driven triggers
- Observability dashboard

```bash
# Terminal 1: Start Inngest Dev Server
npx inngest-cli@latest dev

# Terminal 2: Start the example app
cd examples/inngest
pnpm dev

# Terminal 3: Trigger workflows
curl -X POST http://localhost:3000/api/workflows/greeting \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice"}'
```

View execution history at `http://localhost:8288`

## Development

### Build all packages

```bash
pnpm -r build
```

### Watch mode

```bash
pnpm dev
```
