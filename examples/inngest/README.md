# Inngest Example

This example demonstrates how to use StepKit with Inngest for workflow orchestration.

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Start the Inngest Dev Server (in a separate terminal):
```bash
npx inngest-cli@latest dev
```

3. Start the application:
```bash
pnpm dev
```

## Usage

Trigger the workflow:
```bash
curl -X POST http://localhost:8288/e/local-key \
  -H 'Content-Type: application/json' \
  --data '{
    "name": "workflow/say-hi",
    "data": {
      "name": "Alice"
    }
  }'
```

View the execution in the Inngest Dev Server UI at http://localhost:8288
