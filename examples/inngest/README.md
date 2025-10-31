# Inngest Driver Example

This example demonstrates how to use the `@open-workflow/inngest` driver to run Open Workflow workflows with Inngest.

## Overview

This example creates an Express server that:
- Serves Inngest functions at `/api/inngest`
- Provides a `/trigger` endpoint to trigger workflow execution
- Demonstrates Open Workflow integration with Inngest

## Prerequisites

- Node.js installed
- Inngest Dev Server running (for local development)

## Setup

1. Install dependencies (from the monorepo root):
```bash
pnpm install
```

2. Start the Inngest Dev Server in a separate terminal:
```bash
npx inngest-cli@latest dev
```

3. Start the example server:
```bash
pnpm examples/inngest start
```

## Running the Example

Once the server is running, you can trigger the workflow in several ways:

### Option 1: Using the HTTP endpoint
```bash
curl -X POST http://localhost:3000/trigger
```

### Option 2: Using Inngest's send API
You can also send events directly through the Inngest Dev Server UI at `http://localhost:8288`

## How It Works

1. The server starts and registers the `workflowFunction` with Inngest
2. When you trigger a `workflow/run` event, Inngest calls the function
3. The function creates an `InngestDriver` with the Inngest step context
4. The workflow is executed using Open Workflow's API
5. Inngest handles step memoization and orchestration automatically

## Key Files

- `client.ts` - Inngest client configuration
- `workflows.ts` - Open Workflow definition wrapped in an Inngest function
- `main.ts` - Express server setup with Inngest integration

## What This Demonstrates

- **Inngest Orchestration**: Workflow steps are orchestrated by Inngest
- **Step Memoization**: Completed steps are automatically memoized by Inngest
- **Durable Execution**: Workflows can survive restarts and failures
- **Open Workflow API**: Uses the same `step.run()` API as the in-memory driver
