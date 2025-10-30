# Inngest Driver Example

This example demonstrates using the Inngest driver with the Open Workflow SDK. Workflows are executed using Inngest's cloud infrastructure with full durability, observability, and step memoization.

## Features

- **Durable Execution**: Workflows survive restarts and failures
- **Step Memoization**: Steps are cached and never re-executed
- **Observability**: View execution history in Inngest's dashboard
- **Event-Driven**: Trigger workflows via Inngest events

## Prerequisites

1. Install dependencies:

```bash
pnpm install
```

2. Build the packages:

```bash
cd ../.. && pnpm -r build
```

## Running Locally

### 1. Start the Inngest Dev Server

In a separate terminal:

```bash
npx inngest-cli@latest dev
```

This starts the Inngest Dev Server at `http://localhost:8288`

### 2. Start the Example App

```bash
cd examples/inngest
pnpm dev
```

### 3. View Your Functions

Open `http://localhost:8288` in your browser to see your registered functions and execution history.

### 4. Trigger Workflows

**Greeting Workflow:**

```bash
curl -X POST http://localhost:3000/api/workflows/greeting \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice"}'
```

**Calculation Workflow:**

```bash
curl -X POST http://localhost:3000/api/workflows/calculation \
  -H "Content-Type: application/json" \
  -d '{"x": 5, "y": 3}'
```

## How It Works

### 1. Define Workflows

```typescript
const greetingWorkflow = client.workflow<{ name: string }, string>(
  { id: "greeting-workflow" },
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
```

### 2. Register with Inngest Driver

```typescript
const driver = new InngestDriver({ client: inngest });
const inngestFunction = driver.registerWorkflow(greetingWorkflow);
```

### 3. Serve Inngest Functions

```typescript
app.use("/api/inngest", serve({ client: inngest, functions }));
```

### 4. Invoke Workflows

```typescript
await driver.invokeWorkflow("greeting-workflow", { name: "Alice" });
```

## Deploying to Production

1. Create an account at [inngest.com](https://inngest.com)
2. Get your Event Key and Signing Key
3. Set environment variables:

```bash
INNGEST_EVENT_KEY=your_event_key
INNGEST_SIGNING_KEY=your_signing_key
```

4. Deploy your app
5. Register your endpoint in the Inngest dashboard

## Benefits of Using Inngest

- **Automatic Retries**: Failed steps are automatically retried with exponential backoff
- **Step Memoization**: Completed steps are never re-executed
- **Observability**: Full execution history and logs in the Inngest dashboard
- **Parallelism**: Run steps in parallel with `Promise.all()`
- **Event-Driven**: Trigger workflows from anywhere via Inngest events
- **Scalable**: Inngest handles queuing, concurrency, and infrastructure

## Learn More

- [Inngest Documentation](https://www.inngest.com/docs)
- [Inngest TypeScript SDK](https://github.com/inngest/inngest-js)
