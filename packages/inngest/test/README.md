# Inngest Integration Tests

This directory contains integration tests that run against a real Inngest Dev Server.

## How It Works

The test setup uses Vitest's global setup/teardown hooks to manage the Inngest Dev Server lifecycle:

1. **Before all tests**: The Dev Server is started via `npx inngest-cli@latest dev`
2. **Health check**: The setup polls `http://0.0.0.0:8288` until the server is ready
3. **Tests run**: All integration tests execute against the running Dev Server
4. **After all tests**: The Dev Server is gracefully shut down

## Running Tests

```sh
# Run all integration tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run from the monorepo root
pnpm -C packages/inngest test
```

## Writing Tests

Integration tests should be placed in this directory with the `.test.ts` suffix:

```typescript
import { describe, expect, it } from "vitest";
import { InngestClient } from "../src/main";

describe("my integration tests", () => {
  it("should do something with the dev server", async () => {
    const client = new InngestClient({ id: "test-app" });
    // Test against the running Dev Server on http://0.0.0.0:8288
  });
});
```

## Configuration

- **Test timeout**: 30 seconds per test (configurable in `vitest.config.ts`)
- **Server startup timeout**: 20 seconds
- **Server port**: 8288 (Inngest Dev Server default)

## Reference Implementation

This setup is based on the Go implementation in [inngestgo/tests/main_test.go](https://github.com/inngest/inngestgo/blob/main/tests/main_test.go).
