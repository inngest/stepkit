# Production Backend Example

This example demonstrates how to use the `ProductionClient` from `@stepkit/local` with PostgreSQL for production-ready workflow execution.

## Features Demonstrated

This example showcases various StepKit features:

1. **Simple workflow** with `step.run`
2. **Delayed execution** with `step.sleep`
3. **Child workflows** with `step.invoke`
4. **Parallel execution** with multiple concurrent steps
5. **Signal handling** with `step.waitForSignal`

## Prerequisites

- Node.js 18+ or compatible runtime
- PostgreSQL 12+ installed and running

## Setup

### 1. Start PostgreSQL

Make sure PostgreSQL is running. For local development, you can use the provided npm script:

```bash
pnpm db:start
```

This will start a PostgreSQL container in Docker with the default configuration. Alternatively, you can start it manually:

```bash
docker run --name stepkit-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=stepkit_dev \
  -p 5432:5432 \
  -d postgres:16
```

Or use an existing PostgreSQL installation.

**Database Management Scripts:**
- `pnpm db:start` - Start PostgreSQL in Docker
- `pnpm db:stop` - Stop the PostgreSQL container
- `pnpm db:remove` - Remove the PostgreSQL container
- `pnpm db:logs` - View PostgreSQL logs

### 2. Configure Connection

The example uses the `DATABASE_URL` environment variable for the connection string. If not set, it defaults to:

```
postgresql://postgres:postgres@localhost:5432/stepkit_dev
```

To use a custom connection string:

```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
```

### 3. Install Dependencies

From the repository root:

```bash
pnpm install
```

### 4. Run the Example

```bash
pnpm -C examples/postgres dev
```

Or from within the examples/postgres directory:

```bash
pnpm dev
```

**Quick Start (all-in-one):**
```bash
# Start PostgreSQL and run the example
pnpm db:start && sleep 2 && pnpm dev
```

## What Happens

When you run the example, it will:

1. **Initialize the client** - Connects to PostgreSQL and creates the schema (if needed)
2. **Run Example 1** - Simple greeting workflow with random number generation
3. **Run Example 2** - Delayed greeting with 1-second sleep
4. **Run Example 3** - Orchestrator that invokes multiple child workflows
5. **Run Example 4** - Parallel task execution
6. **Run Example 5** - Approval workflow that waits for a signal
7. **Clean up** - Gracefully shuts down the client

## Expected Output

```
Starting ProductionClient example...

✓ Client initialized and connected to database

Example 1: Simple greeting workflow
-----------------------------------
Hello Alice! Your random number is 42.

Example 2: Delayed greeting workflow (1 second delay)
------------------------------------------------------
Hello Bob! The time is now 2024-01-15T10:30:45.123Z.

Example 3: Orchestrator workflow with child workflows
----------------------------------------------------
{
  "message": "Greeted everyone!",
  "greetings": [
    "Hello Charlie! Your random number is 73.",
    "Hello Diana! Your random number is 21.",
    "Hello Eve! Your random number is 89."
  ]
}

Example 4: Parallel task execution
----------------------------------
{
  "message": "All tasks completed!",
  "results": [
    { "task": "Task A", "completed": true, "duration": 87 },
    { "task": "Task B", "completed": true, "duration": 62 },
    { "task": "Task C", "completed": true, "duration": 95 },
    { "task": "Task D", "completed": true, "duration": 71 }
  ]
}

Example 5: Approval workflow with signals
-----------------------------------------
Starting approval workflow (non-blocking)...
Workflow started with request ID: req-1705315845123
Sending approval signal...
Waiting for workflow to complete...
{
  "status": "approved",
  "message": "Request \"Deploy to production\" was approved!"
}

Shutting down...
✓ Client closed successfully
```

## Database Schema

The `ProductionClient` automatically creates the following tables:

- `runs` - Stores workflow execution state
- `ops` - Stores operation results
- `waiting_invokes` - Tracks pending child workflow invocations
- `waiting_signals` - Tracks workflows waiting for signals
- `event_queue` - Stores incoming events
- `exec_queue` - Stores execution tasks

You can inspect these tables to see how StepKit manages workflow state:

```sql
-- View active workflow runs
SELECT run_id, workflow_id, created_at FROM runs;

-- View pending queue items
SELECT * FROM event_queue WHERE time <= EXTRACT(EPOCH FROM NOW()) * 1000;

-- View waiting signals
SELECT * FROM waiting_signals;
```

## Customization

### Change Queue Poll Interval

In `client.ts`, adjust the `queuePollInterval`:

```typescript
export const client = new ProductionClient({
  connectionString,
  queuePollInterval: 200, // Poll every 200ms instead of 100ms
});
```

### Disable Auto-Migration

To manage schema migrations manually:

```typescript
export const client = new ProductionClient({
  connectionString,
  autoMigrate: false,
});
```

### Configure Connection Pool

To customize the PostgreSQL connection pool:

```typescript
export const client = new ProductionClient({
  connectionString,
  poolConfig: {
    max: 20, // Maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
});
```

## Production Considerations

### Multiple Workers

You can run multiple instances of your application with the same database. The PostgreSQL queue implementation uses `FOR UPDATE SKIP LOCKED` to ensure each queue item is processed only once.

```bash
# Terminal 1
pnpm -C examples/production dev

# Terminal 2 (same database)
pnpm -C examples/production dev
```

Both workers will safely share the workload.

### Monitoring

Monitor your workflows by querying the database:

```sql
-- Active workflows
SELECT workflow_id, COUNT(*) as count
FROM runs
WHERE result IS NULL
GROUP BY workflow_id;

-- Queue depth
SELECT COUNT(*) as pending_items
FROM event_queue
WHERE time <= EXTRACT(EPOCH FROM NOW()) * 1000;
```

### Cleanup

To clean up old workflow data, you can manually delete completed runs:

```sql
-- Delete completed runs older than 7 days
DELETE FROM runs
WHERE result IS NOT NULL
  AND updated_at < NOW() - INTERVAL '7 days';
```

Consider setting up automated cleanup jobs for production use.

## Troubleshooting

### Connection Refused

If you see "connection refused" errors, ensure PostgreSQL is running:

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# View PostgreSQL logs
docker logs stepkit-postgres
```

### Schema Errors

If you encounter schema-related errors, you can reset the database:

```sql
DROP TABLE IF EXISTS runs, ops, waiting_invokes, waiting_signals, event_queue, exec_queue CASCADE;
```

Then restart the application to recreate the schema.

### Performance Issues

If workflows are running slowly:

1. Check queue depth: `SELECT COUNT(*) FROM event_queue;`
2. Monitor connection pool: Increase `max` in `poolConfig`
3. Add database indexes if running many workflows
4. Reduce `queuePollInterval` for lower latency

## Next Steps

- Try creating your own workflows in `workflows.ts`
- Experiment with different step operations
- Add error handling and retry logic
- Deploy to a production environment with a managed PostgreSQL database
