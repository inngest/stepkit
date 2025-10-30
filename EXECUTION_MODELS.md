# Execution Models

Open Workflow supports two distinct execution models, each with different characteristics and use cases.

## 1. Continuous Execution (InMemoryDriver)

**How it works:**

- Workflow function runs **once**
- Steps are discovered and executed as encountered
- Everything happens in a single invocation
- Fast and simple, no re-entry overhead

**Example Output:**

```
→ Starting workflow
→ Running step: uppercase
→ Running step: create-greeting
Result: Hello, ALICE!
```

**Use Cases:**

- Local development and testing
- Simple workflows that don't need durability
- Performance-critical applications
- Workflows that complete quickly

**Code:**

```typescript
import { InMemoryDriver } from "@open-workflow/driver-in-memory";

const driver = new InMemoryDriver();
const client = new WorkflowClient(driver);
```

## 2. Checkpoint/Re-entry Execution (CheckpointInMemoryDriver, InngestDriver)

**How it works:**

- Workflow function runs **multiple times** (re-entry)
- Each invocation executes **one step**, then interrupts
- Next invocation starts from the beginning with updated state
- Completed steps are memoized (skipped)
- Continues until all steps complete

**Example Output:**

```
→ Starting workflow
→ Running step: uppercase
→ Starting workflow          (re-entry!)
→ Running step: create-greeting
→ Starting workflow          (re-entry!)
Result: Hello, ALICE!
```

**Execution Flow:**

1. **First Invocation:** Discovers `uppercase` step, executes it, interrupts
2. **Second Invocation:** Memoizes `uppercase`, discovers `create-greeting`, executes it, interrupts
3. **Third Invocation:** Memoizes both steps, workflow completes

**Use Cases:**

- Production workflows requiring durability
- Long-running workflows that need resilience
- Workflows that must survive process crashes
- Integration with durable execution platforms (Inngest, Temporal, etc.)

**Code:**

```typescript
import { CheckpointInMemoryDriver } from "@open-workflow/driver-in-memory";

const driver = new CheckpointInMemoryDriver();
const client = new WorkflowClient(driver);
```

## Why Re-entry Matters

The checkpoint/re-entry model is the foundation of durable workflow execution:

### 1. **Durability**

After each step completes, state is persisted. If the process crashes, execution can resume from the last checkpoint:

```
Invocation 1: Execute step A ✓ → Save state
[CRASH]
Invocation 2: Skip step A (memoized), execute step B ✓
```

### 2. **Observability**

Each step execution is a discrete unit with:

- Start/end timestamps
- Input/output values
- Execution duration
- Error information

### 3. **Determinism**

The workflow function must be deterministic because it runs multiple times:

```typescript
// ❌ Bad: Different result each time
const timestamp = Date.now();

// ✓ Good: Use step.run for non-deterministic operations
const timestamp = await step.run("get-timestamp", () => Date.now());
```

### 4. **State Management**

Step results are automatically cached and reused across invocations:

```typescript
// First invocation
const user = await step.run("fetch-user", async () => {
  return await db.users.find(userId); // Executes
});

// Second invocation (same workflow run)
const user = await step.run("fetch-user", async () => {
  return await db.users.find(userId); // Skipped! Returns cached result
});
```

## Comparison

| Feature               | Continuous   | Checkpoint                 |
| --------------------- | ------------ | -------------------------- |
| **Invocations**       | 1            | Multiple (N+1 for N steps) |
| **Performance**       | Fast         | Slower (re-entry overhead) |
| **Durability**        | None         | Full                       |
| **Observability**     | Limited      | Rich                       |
| **Crash Recovery**    | ❌           | ✓                          |
| **Step Memoization**  | ❌           | ✓                          |
| **Use in Production** | Testing only | Production-ready           |

## Implementation Details

### Driver Interface

Drivers control execution through the `onStepExecuted` hook:

```typescript
async onStepExecuted(
  options: WorkflowExecutionOptions,
  step: OutgoingOp,
  state: Record<string, MemoizedOp>,
): Promise<FlowControlResult> {
  // Save step state
  this.state.set(step.id, step);

  // Continuous: Keep going
  return { action: FlowControl.Continue };

  // Checkpoint: Interrupt and return
  return {
    action: FlowControl.Interrupt,
    result: { type: "step-ran", step, ops: state },
  };
}
```

### Re-entry Loop

The `Workflow.invoke()` method implements the re-entry loop:

```typescript
async invoke(input: TInput): Promise<TOutput> {
  let stepState = {};

  while (true) {
    const result = await executor.start();

    if (result.type === "function-resolved") {
      return result.data; // Done!
    }

    if (result.type === "step-ran") {
      // Add step result to state
      stepState[result.step.id] = result.step;
      // Re-invoke workflow with updated state
      continue;
    }
  }
}
```

## Examples

See working examples:

- **Continuous:** `examples/basic/src/index.ts`
- **Checkpoint:** `examples/basic/src/checkpoint.ts`
- **Inngest:** `examples/inngest/src/index.ts`

Run them:

```bash
# Continuous execution
cd examples/basic
pnpm dev

# Checkpoint execution
pnpm dev:checkpoint

# Inngest (checkpoint + cloud)
cd ../inngest
npx inngest-cli@latest dev  # Terminal 1
pnpm dev                     # Terminal 2
```

## Best Practices

### 1. Write Deterministic Workflows

```typescript
// ❌ Bad: Non-deterministic
const workflow = client.workflow(async ({ input, step }) => {
  const random = Math.random(); // Different each invocation!
  const result = await step.run("process", () => processData(random));
  return result;
});

// ✓ Good: Deterministic
const workflow = client.workflow(async ({ input, step }) => {
  const random = await step.run("generate-random", () => Math.random());
  const result = await step.run("process", () => processData(random));
  return result;
});
```

### 2. Use Steps for Side Effects

```typescript
// ❌ Bad: Side effect outside step
await sendEmail(user.email);
const result = await step.run("process", () => ...);

// ✓ Good: Side effect in step
const result = await step.run("send-email", async () => {
  await sendEmail(user.email);
  return { sent: true };
});
```

### 3. Handle Step Errors Gracefully

```typescript
const result = await step.run("risky-operation", async () => {
  try {
    return await riskyAPI();
  } catch (error) {
    // Handle error within step
    return { success: false, error };
  }
});

if (!result.success) {
  // Take alternative path
}
```

## Choosing an Execution Model

**Use Continuous (InMemoryDriver) when:**

- Building and testing locally
- Workflows complete quickly (< 1 second)
- You don't need crash recovery
- Performance is critical

**Use Checkpoint (CheckpointInMemoryDriver/InngestDriver) when:**

- Deploying to production
- Workflows may take seconds/minutes/hours
- You need durability and observability
- You want automatic retries and crash recovery

## Learn More

- [Inngest Execution Model](https://www.inngest.com/docs/features/inngest-functions/steps-workflows)
- [Temporal Workflow Execution](https://docs.temporal.io/workflows)
- Core implementation: `packages/core/src/executor.ts`
- Driver implementations: `packages/drivers/*/src/`
