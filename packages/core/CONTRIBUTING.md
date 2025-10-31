# `@open-workflow/core`

Core tools for building an Open Workflow SDK.

## Testing

```sh
pnpm test
pnpm test:watch
pnpm type-check
```

## Architecture

### Driver Pattern

The architecture separates concerns using two driver interfaces:

**ExecutionDriver** (`packages/core/src/executionDriver.ts`):

- Handles ops found by the underying processer
- Define custom ops (i.e. methods on the `step` object)
- Custom ops are type-safe within workflow handlers due to generics

**RunStateDriver** (`packages/core/src/runStateDriver.ts`):

- Manages run and op state persistence

### Operations (Ops)

Operations represent discrete units of work. They have 2 main variants:

- **OpFound**: Discovered but not handled by execution driver
- **OpResult**: Handled by execution driver

Operations have "opcodes" that are used to identify the type of operation.

### Control Flow and Pause/Resume Mechanism

The process loop is responsible for:

- Finding ops
- Pausing ops until the execution driver allows them to continue
- Informing the execution driver of the found ops (via the `onOpsFound` callback)
- Handling the execution driver's desired control flow (continue or interrupt)

An important implementation detail is that some ops are permanently paused. This is intentional, since it allows us to interrupt the workflow early. This promise is eventually deleted by the garbage collector, since it isn't referenced anywhere else.
