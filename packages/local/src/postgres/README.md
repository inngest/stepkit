# Production Backend for StepKit

A production-ready backend implementation for StepKit using PostgreSQL for both state management and queue operations.

## Features

- **PostgreSQL-based persistence**: Durable state storage with ACID guarantees
- **PostgreSQL-based queue**: Reliable queue operations using `FOR UPDATE SKIP LOCKED` pattern
- **Transactional consistency**: Queue and state operations within the same database
- **Concurrent execution**: Multiple client instances can safely share the same database
- **Automatic schema migration**: Database schema initialized on startup (configurable)
- **Connection pooling**: Efficient database connection management via pg.Pool

## Installation

The production backend is included in `@stepkit/local`. Ensure you have PostgreSQL installed and running.

```bash
npm install @stepkit/local pg
# or
pnpm add @stepkit/local pg
```

## Usage

```typescript
import { ProductionClient } from "@stepkit/local";

const client = new ProductionClient({
  connectionString: "postgresql://user:password@localhost:5432/stepkit",
  // Optional configurations:
  queuePollInterval: 100, // Queue polling interval in ms (default: 100)
  autoMigrate: true, // Auto-create schema (default: true)
  poolConfig: {
    // Optional pg.Pool configuration
    max: 20, // Maximum pool size
  },
});

// Initialize the client (runs migrations if autoMigrate is true)
await client.start();

// Register workflows
client.registerWorkflow(myWorkflow);

// Start a workflow
const result = await client.invoke(myWorkflow, { data: "input" });

// Clean shutdown
client.stop();
await client.close();
```

## Database Schema

The production backend automatically creates the following tables:

- **runs**: Stores workflow execution state
- **ops**: Stores operation results
- **waiting_invokes**: Tracks pending child workflow invocations
- **waiting_signals**: Tracks workflows waiting for signals
- **event_queue**: Stores incoming events to be processed
- **exec_queue**: Stores workflow execution tasks

## Configuration

### Connection String

The connection string can be provided directly or via environment variable:

```typescript
const client = new ProductionClient({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost/stepkit",
});
```

### Queue Polling

The queue polling interval controls how often the client checks for new items:

```typescript
const client = new ProductionClient({
  connectionString: "postgresql://localhost/stepkit",
  queuePollInterval: 200, // Check every 200ms
});
```

The implementation uses exponential backoff when the queue is empty, automatically adjusting the polling interval from the configured value up to 1 second.

### Manual Schema Management

If you prefer to manage schema migrations manually:

```typescript
const client = new ProductionClient({
  connectionString: "postgresql://localhost/stepkit",
  autoMigrate: false,
});
```

Then run the schema SQL manually using the exported `SCHEMA_SQL` from `db/schema.ts`.

## Testing

The production backend includes comprehensive tests that run the same test suites as the in-memory and file-system backends.

To run tests, ensure PostgreSQL is running and set the connection string:

```bash
export POSTGRES_TEST_URL="postgresql://localhost:5432/stepkit_test"
pnpm test
```

## Performance Considerations

- **Throughput**: The queue can process 10-100 items/second depending on poll interval and database performance
- **Concurrency**: Supports multiple client instances safely sharing the same database
- **Connection pooling**: Default pool size is 10 connections; adjust via `poolConfig` based on your workload
- **Indexes**: Automatically creates indexes on queue time columns and lookup columns for optimal performance

## Comparison with Other Backends

| Feature | InMemory | FileSystem | Production |
|---------|----------|------------|------------|
| Persistence | ✗ | ✓ (Files) | ✓ (PostgreSQL) |
| Concurrency | ✗ | Limited | ✓ |
| Production-ready | ✗ | ✗ | ✓ |
| Setup complexity | Low | Low | Medium |
| Performance | Fastest | Medium | Good |

## Future Enhancements

Potential improvements for future versions:

- `LISTEN/NOTIFY` for queue operations (eliminate polling)
- Built-in metrics and observability
- Dead letter queue for failed operations
- Retention policies for completed workflows
- Read replicas for state queries
- Batch queue operations
