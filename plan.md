# Plan: Production-Ready Backend for StepKit

## Overview

Create a production-ready backend implementation for StepKit that uses real persistence and queuing infrastructure instead of in-memory or filesystem-based solutions. This will be added as a new subdirectory under `packages/local/` called `production`.

## Architecture Analysis

### Current Structure

The `packages/local` package contains:
- **`common/`** - Shared logic including:
  - `orchestrator.ts` - High-level orchestration of events and runs
  - `queue.ts` - Queue interface definitions (`SortedQueue<T>`, `QueueItem<T>`)
  - `stateDriver.ts` - State management interfaces (`LocalStateDriver`, `InvokeManager`, `SignalManager`)
  - `handlers/` - Workflow operation handlers (invoke, sleep, waitForSignal, etc.)
  - `utils.ts` - Helper functions

- **`in-memory/`** - Synchronous execution backend:
  - `queue.ts` - Array-based sorted queue with setInterval polling
  - `stateDriver.ts` - Map-based state storage
  - `client.ts` - Client implementation

- **`file-system/`** - File-based persistent backend:
  - `queue.ts` - File-based queue using JSON files
  - `stateDriver.ts` - JSON file-based state storage
  - `client.ts` - Client implementation

### Key Interfaces to Implement

1. **`SortedQueue<T>`** (from `common/queue.ts`):
   - `add(item: QueueItem<T>): Promise<void>` - Enqueue with timestamp
   - `getNext(): Promise<QueueItem<T> | undefined>` - Dequeue next ready item
   - `handle(callback): () => void` - Process queue items continuously

2. **`LocalStateDriver`** (from `common/stateDriver.ts`):
   - Run management: `addRun()`, `getRun()`, `endRun()`
   - Op management: `getOp()`, `setOp()`, `incrementOpAttempt()`
   - Waiting invokes: `waitingInvokes.add()`, `waitingInvokes.pop()`
   - Waiting signals: `waitingSignals.add()`, `waitingSignals.pop()`

## Technology Choices

### Database: PostgreSQL
- Production-ready, ACID compliant
- Excellent JSON support for storing workflow state
- Native support for advisory locks (useful for dequeuing)
- Common in production environments
- Can use `pg` npm package

### Queue: PostgreSQL-based Queue
- Use PostgreSQL as the queue backend (simpler deployment)
- Implement using a `queue` table with:
  - Timestamp-based ordering
  - Row locking for atomic dequeue operations
  - Support for delayed execution (scheduled queue items)
- Alternative considered: Redis, BullMQ - decided against to minimize dependencies

### Why PostgreSQL for Both?
- Single dependency reduces operational complexity
- Transactional consistency between state and queue
- PostgreSQL's `FOR UPDATE SKIP LOCKED` enables efficient queue semantics
- Production-proven for queue workloads (pg_boss pattern)

## Implementation Plan

### 1. Database Schema Design

Create migrations or schema initialization for:

**`runs` table**:
- `run_id` (TEXT PRIMARY KEY)
- `workflow_id` (TEXT)
- `ctx` (JSONB) - Execution context
- `max_attempts` (INTEGER)
- `op_attempts` (JSONB) - Map of hashedOpId -> attempt count
- `result` (JSONB) - Final result if completed
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**`ops` table**:
- `run_id` (TEXT)
- `hashed_op_id` (TEXT)
- `op_result` (JSONB)
- `created_at` (TIMESTAMP)
- PRIMARY KEY: `(run_id, hashed_op_id)`

**`waiting_invokes` table**:
- `child_run_id` (TEXT UNIQUE)
- `parent_run_id` (TEXT)
- `hashed_op_id` (TEXT)
- `invoke_data` (JSONB) - Full WaitingInvoke object
- UNIQUE constraint on `(parent_run_id, hashed_op_id)`

**`waiting_signals` table**:
- `signal_name` (TEXT PRIMARY KEY)
- `signal_data` (JSONB) - Full WaitingSignal object

**`event_queue` table**:
- `id` (SERIAL PRIMARY KEY)
- `time` (BIGINT) - Execution timestamp (ms)
- `data` (JSONB) - Event data
- `status` (TEXT) - 'pending', 'processing', 'completed'
- `created_at` (TIMESTAMP)

**`exec_queue` table**:
- `id` (SERIAL PRIMARY KEY)
- `time` (BIGINT) - Execution timestamp (ms)
- `data` (JSONB) - Execution queue data
- `status` (TEXT) - 'pending', 'processing', 'completed'
- `created_at` (TIMESTAMP)

### 2. Directory Structure

```
packages/local/src/production/
├── client.ts              # ProductionClient implementation
├── executionDriver.ts     # ProductionDriver implementation
├── queue.ts               # PostgresQueue implementation
├── stateDriver.ts         # PostgresStateDriver implementation
├── db/
│   ├── connection.ts      # Database connection management
│   ├── schema.ts          # Schema initialization SQL
│   └── migrations.ts      # Optional: migration system
└── utils/
    └── config.ts          # Configuration types and defaults
```

### 3. Queue Implementation (`PostgresQueue`)

**Key features**:
- Use `FOR UPDATE SKIP LOCKED` for atomic dequeue
- Poll with configurable interval (default 100ms)
- Support for delayed/scheduled items
- Automatic cleanup of processed items (or keep with 'completed' status)

**Implementation approach**:
```typescript
class PostgresQueue<T> implements SortedQueue<T> {
  async add(item: QueueItem<T>): Promise<void> {
    // INSERT into queue table with timestamp and JSON data
  }

  async getNext(): Promise<QueueItem<T> | undefined> {
    // SELECT ... WHERE time <= NOW() AND status = 'pending'
    // ORDER BY time LIMIT 1
    // FOR UPDATE SKIP LOCKED
    // Update status to 'processing' and DELETE or mark completed
  }

  handle(callback): () => void {
    // setInterval to poll getNext() and invoke callback
  }
}
```

### 4. State Driver Implementation (`PostgresStateDriver`)

**Key components**:

**PostgresInvokeManager**:
- `add()`: INSERT into `waiting_invokes`
- `popByChildRun()`: DELETE and return from `waiting_invokes` WHERE `child_run_id`
- `popByParentOp()`: DELETE and return WHERE `parent_run_id` AND `hashed_op_id`

**PostgresSignalManager**:
- `add()`: INSERT into `waiting_signals`
- `pop()`: DELETE and return WHERE `signal_name`

**PostgresStateDriver**:
- `addRun()`: INSERT into `runs` table
- `getRun()`: SELECT from `runs` WHERE `run_id`
- `endRun()`: UPDATE `runs` SET `result`
- `getOp()`: SELECT from `ops` WHERE `run_id` AND `hashed_op_id`
- `setOp()`: Handle retry logic, then INSERT/UPDATE `ops`
- `incrementOpAttempt()`: UPDATE `runs` JSONB field `op_attempts`
- `getMaxAttempts()`: SELECT `max_attempts` from `runs`

### 5. Client Implementation (`ProductionClient`)

**Configuration options**:
```typescript
type ProductionClientOptions = {
  connectionString: string;  // PostgreSQL connection string
  poolConfig?: PoolConfig;   // Optional pg pool configuration
  queuePollInterval?: number; // Queue polling interval (default 100ms)
  autoMigrate?: boolean;     // Auto-run schema initialization (default true)
}
```

**Structure**:
- Similar to `FileSystemClient` and `InMemoryClient`
- Initialize database connection pool
- Create `PostgresQueue` instances for event and exec queues
- Create `PostgresStateDriver` with database pool
- Pass to `Orchestrator` from `common/`
- Provide `stop()` method to close database connections

### 6. Connection Management

**Features needed**:
- Connection pooling using `pg.Pool`
- Graceful shutdown
- Health checks
- Connection retry logic
- Transaction support (for atomic operations)

### 7. Testing Strategy

**Create test file**: `packages/local/test/production/common.test.ts`

Approach:
- Use existing test utilities from `test/utils.ts`
- Reuse test scenarios from `test/common/` directory:
  - `step.run.ts`
  - `step.sleep.ts`
  - `step.invoke.ts`
  - `step.waitForSignal.ts`
  - `parallelSteps.ts`
- Use test database (Docker container or local PostgreSQL)
- Clean up test data between tests

### 8. Dependencies to Add

Add to `packages/local/package.json`:
```json
{
  "dependencies": {
    "pg": "^8.11.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0"
  }
}
```

### 9. Documentation Updates

**Update `packages/local/README.md`** (if exists) or create one:
- Document `ProductionClient` usage
- Provide example configuration
- Document schema requirements
- Migration guidance

**Update root `README.md`**:
- Mention production backend option

## Implementation Steps (Ordered)

1. **Add PostgreSQL dependencies** to `package.json`
2. **Create directory structure** under `packages/local/src/production/`
3. **Implement database schema** (`db/schema.ts`)
4. **Implement database connection management** (`db/connection.ts`)
5. **Implement PostgresQueue** (`queue.ts`)
   - Event queue
   - Exec queue
6. **Implement PostgresStateDriver** (`stateDriver.ts`)
   - PostgresInvokeManager
   - PostgresSignalManager
   - PostgresStateDriver main class
7. **Implement ProductionDriver** (`executionDriver.ts`)
   - Likely can reuse FileSystemDriver pattern
8. **Implement ProductionClient** (`client.ts`)
9. **Update exports** in `packages/local/src/main.ts`
10. **Write tests** (`test/production/common.test.ts`)
11. **Create example** (`examples/production/` directory)
12. **Update documentation**

## Design Decisions & Rationale

### PostgreSQL over Redis/Other Solutions
- **Pro**: Single infrastructure dependency
- **Pro**: Transactional consistency
- **Pro**: No additional services to manage
- **Pro**: Proven pattern (pg_boss, graphile-worker)
- **Con**: Slightly higher latency than Redis
- **Decision**: PostgreSQL's reliability and operational simplicity outweighs Redis's performance edge for this use case

### Queue Cleanup Strategy
Two options:
1. **DELETE processed items**: Simpler, less storage
2. **Mark as 'completed'**: Better observability, audit trail

**Recommendation**: Start with DELETE for simplicity, add retention config later if needed

### Schema Initialization
- Auto-migrate by default (can be disabled)
- Provide raw SQL for manual migration
- Check if tables exist before creating

### Connection Pooling
- Use `pg.Pool` with sensible defaults
- Allow configuration override
- Ensure proper cleanup on shutdown

### Error Handling
- Database connection failures: Retry with exponential backoff
- Queue processing errors: Log and continue (matches existing backends)
- Transient errors: Leverage existing retry logic in orchestrator

## Migration from FileSystem Backend

Users can migrate by:
1. Export workflow state from filesystem (if needed)
2. Initialize PostgreSQL database
3. Update client instantiation
4. Run new workflows directly (StepKit workflows are idempotent)

No automatic migration tool planned initially.

## Performance Considerations

### Expected Throughput
- Queue polling: 10-100 items/second (depending on poll interval)
- State operations: Limited by PostgreSQL transaction rate
- Comparable to filesystem backend, better than in-memory for multi-process scenarios

### Optimization Opportunities (Future)
- Batch queue operations
- LISTEN/NOTIFY for queue instead of polling
- Read replicas for state queries
- Prepared statements for common queries
- Connection pooling tuning

### Indexing Strategy
- Primary keys provide base indexing
- Add index on `event_queue(status, time)` and `exec_queue(status, time)` for efficient dequeue
- Monitor and add indexes based on query patterns

## Security Considerations

- Use parameterized queries (prevent SQL injection)
- Support SSL/TLS connections
- Allow connection string from environment variables
- No sensitive data logged
- Follow principle of least privilege for database user

## Backward Compatibility

- Pure addition, no breaking changes to existing backends
- Shares all common code (orchestrator, handlers)
- Compatible with existing workflow definitions
- Same client API as InMemoryClient and FileSystemClient

## Success Criteria

1. ✅ All existing tests pass with ProductionClient
2. ✅ Can run example workflows end-to-end
3. ✅ Handles concurrent workflow execution correctly
4. ✅ Proper cleanup of database connections
5. ✅ Documentation complete
6. ✅ Type-safe API matching other clients

## Future Enhancements (Out of Scope)

- Horizontal scaling with multiple workers
- Built-in observability/metrics
- Queue priority system
- Dead letter queue
- Automatic schema migrations
- Dashboard for monitoring workflows
- Support for other databases (MySQL, SQLite)

## Open Questions

1. **Queue polling vs LISTEN/NOTIFY**: Start with polling for simplicity, can optimize later
2. **Retention policy**: Default to no retention, make configurable
3. **Transaction boundaries**: Use transactions for critical paths (dequeue + state update)
4. **Pool size defaults**: Start with pg defaults (10 connections), document tuning

## Summary

This plan creates a production-ready StepKit backend using PostgreSQL for both state and queue management. It reuses the battle-tested `common/` orchestrator and handlers while providing durable, reliable persistence. The implementation follows established patterns from the existing file-system backend while adding the robustness needed for production use.
