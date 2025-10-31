# Inngest Driver Example

demonstrates how to use the `@open-workflow/inngest` driver to run Open Workflow workflows with Inngest.


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


