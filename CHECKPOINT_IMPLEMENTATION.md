# Checkpoint/Re-entry Implementation Summary

This document explains the implementation of Inngest-style checkpoint/re-entry execution in Open Workflow.

## Problem

The original implementation ran workflows in a single continuous execution:

```
→ Starting workflow
→ Running step: uppercase
→ Running step: create-greeting
Result: Hello, ALICE!
```

Inngest's model uses re-entry, running the workflow multiple times:

```
→ Starting workflow
→ Running step: uppercase
→ Starting workflow       (re-entry!)
→ Running step: create-greeting
→ Starting workflow       (re-entry!)
Result: Hello, ALICE!
```

## Solution

### 1. Driver-Level Control (packages/drivers/in-memory/src/checkpoint.ts)

The `CheckpointInMemoryDriver` returns `FlowControl.Interrupt` after executing each step:

```typescript
async onStepExecuted(
  options: WorkflowExecutionOptions,
  step: OutgoingOp,
  state: Record<string, MemoizedOp>,
): Promise<FlowControlResult> {
  // Save step result
  this.state.set(step.id, step);

  // CRITICAL: Interrupt execution
  return {
    action: FlowControl.Interrupt,
    result: {
      type: "step-ran",
      step,
      ops: state,
    },
  };
}
```

This tells the executor to stop and return, rather than continuing.

### 2. Re-entry Loop (packages/core/src/workflow.ts)

The `invoke()` method implements a re-entry loop:

```typescript
async invoke(input: TInput): Promise<TOutput> {
  const stepState: Record<string, any> = {};
  const stepCompletionOrder: string[] = [];

  while (true) {
    // Execute workflow with current state
    const result = await executor.start();

    if (result.type === "function-resolved") {
      return result.data; // Done!
    }

    if (result.type === "step-ran") {
      // Add step result to state
      stepState[result.step.id] = {
        data: result.step.data,
        fulfilled: true,
      };

      // Re-invoke from beginning with updated state
      continue;
    }
  }
}
```

### 3. Step Memoization (packages/core/src/executor.ts)

On each invocation, the executor checks if a step has already been completed:

```typescript
const stepState = this.state.stepState[hashedId];
if (stepState) {
  // Step was completed in previous invocation
  stepState.seen = true;
  this.state.remainingStepsToBeSeen.delete(hashedId);
  isFulfilled = true; // Skip execution
}
```

If fulfilled, the step's promise is immediately resolved with the cached result:

```typescript
if (isFulfilled && stepState) {
  resolve(stepState.data); // Use cached result
}
```

## Execution Flow

### First Invocation

1. Workflow function starts
2. Encounters `step.run("uppercase", fn)`
3. No cached state, so step is not fulfilled
4. Step function executes
5. Driver returns `Interrupt` with step result
6. Executor stops and returns

### Second Invocation

1. Workflow function starts **again** (re-entry!)
2. Encounters `step.run("uppercase", fn)` **again**
3. Checks state - step was completed in previous invocation
4. Promise immediately resolves with cached data
5. Workflow continues to next step
6. Encounters `step.run("create-greeting", fn)`
7. Step executes
8. Driver returns `Interrupt`
9. Executor stops and returns

### Third Invocation

1. Workflow function starts **again**
2. Both steps are memoized
3. Workflow completes
4. Returns final result

## Key Implementation Details

### 1. Step Hashing

Steps are identified by SHA-1 hash of their ID:

```typescript
const hashedId = hashId(stepId);
```

This ensures consistent identification across invocations.

### 2. Step Indexing

If the same step ID is used multiple times (e.g., in a loop), steps are automatically indexed:

```typescript
"step-id"; // First occurrence
"step-id:1"; // Second occurrence
"step-id:2"; // Third occurrence
```

### 3. Completion Order Tracking

The order in which steps complete is tracked:

```typescript
stepCompletionOrder: ["hash1", "hash2", "hash3"];
```

This is used for determinism checking and to detect when all state has been seen.

### 4. Promise Management

Each step has a deferred promise that is resolved either:

- Immediately (if memoized)
- After execution (if new)

The workflow function awaits these promises, so it naturally pauses at each step boundary.

## Comparison: Continuous vs Checkpoint

| Aspect                   | Continuous (InMemoryDriver) | Checkpoint (CheckpointInMemoryDriver) |
| ------------------------ | --------------------------- | ------------------------------------- |
| **Function Invocations** | 1                           | N+1 (for N steps)                     |
| **Driver Behavior**      | Returns `Continue`          | Returns `Interrupt`                   |
| **State Management**     | In-memory only              | Persistent (can be external)          |
| **Step Memoization**     | None                        | Full                                  |
| **Crash Recovery**       | ❌                          | ✓                                     |
| **Performance**          | Fast                        | Slower (re-entry overhead)            |

## Testing

Run the examples to see both models in action:

```bash
cd examples/basic

# Continuous execution (1 invocation)
pnpm dev

# Checkpoint execution (3 invocations)
pnpm dev:checkpoint
```

## Integration with Inngest

The Inngest driver doesn't actually use our executor - it delegates to Inngest's native step execution. However, the checkpoint model is essential for understanding how Inngest works:

1. Inngest calls your function
2. Function runs until first step
3. Step executes, Inngest stores result
4. Function returns (Inngest interrupts)
5. Inngest calls function again with step results
6. Function memoizes completed steps, continues
7. Repeat until complete

This is exactly what `CheckpointInMemoryDriver` simulates!

## Benefits of Re-entry Model

### 1. Durability

Each step completion is a checkpoint. If the process crashes:

```
Run 1: Step A ✓ [saved]
Run 2: Step B ✓ [saved]
[CRASH]
Run 3: Steps A,B memoized, Step C ✓
```

### 2. Observability

Each step execution is discrete:

- Individual logs
- Separate timing
- Clear failure points

### 3. Determinism

Forces workflow code to be deterministic:

```typescript
// ❌ Bad: Different each time
const timestamp = Date.now();

// ✓ Good: Captured in step
const timestamp = await step.run("get-ts", () => Date.now());
```

### 4. Replay

Can replay workflow execution from any checkpoint by providing state up to that point.

## Implementation Challenges

### Challenge 1: Promise Resolution Timing

**Problem:** How do we make the workflow function pause at step boundaries?

**Solution:** Each step returns a deferred promise. The workflow function awaits it. The promise is resolved either immediately (if memoized) or after execution.

### Challenge 2: Multiple Executions

**Problem:** How do we execute the workflow function multiple times without code duplication?

**Solution:** The re-entry loop in `invoke()` calls the same executor repeatedly with updated state.

### Challenge 3: State Consistency

**Problem:** How do we ensure state is consistent across invocations?

**Solution:** Step results are hashed and stored in a map. The same hash always retrieves the same result.

## Future Enhancements

Potential improvements:

1. **Parallel Steps**: Execute multiple steps concurrently
2. **Step Timeouts**: Automatic timeout handling
3. **Conditional Interrupts**: Interrupt only for certain step types
4. **Custom Memoization**: Driver-controlled memoization strategies
5. **Step Retries**: Automatic retry with backoff
6. **Execution Limits**: Max invocations/duration safeguards

## References

- Core implementation: `packages/core/src/executor.ts`
- Checkpoint driver: `packages/drivers/in-memory/src/checkpoint.ts`
- Inngest v2 execution: `/Users/jacob/Documents/projects/inngest/inngest-js/packages/inngest/src/components/execution/v2.ts`
- Examples: `examples/basic/src/checkpoint.ts`
