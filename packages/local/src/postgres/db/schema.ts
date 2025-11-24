export const SCHEMA_SQL = `
-- Runs table: stores workflow execution state
CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  ctx JSONB NOT NULL,
  max_attempts INTEGER NOT NULL,
  op_attempts JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Ops table: stores operation results
CREATE TABLE IF NOT EXISTS ops (
  run_id TEXT NOT NULL,
  hashed_op_id TEXT NOT NULL,
  op_result JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, hashed_op_id)
);

-- Waiting invokes table: tracks pending child workflow invocations
CREATE TABLE IF NOT EXISTS waiting_invokes (
  child_run_id TEXT UNIQUE NOT NULL,
  parent_run_id TEXT NOT NULL,
  hashed_op_id TEXT NOT NULL,
  invoke_data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (parent_run_id, hashed_op_id)
);

-- Waiting signals table: tracks workflows waiting for signals
CREATE TABLE IF NOT EXISTS waiting_signals (
  signal_name TEXT PRIMARY KEY,
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Event queue table: stores incoming events to be processed
CREATE TABLE IF NOT EXISTS event_queue (
  id SERIAL PRIMARY KEY,
  time BIGINT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Exec queue table: stores workflow execution tasks
CREATE TABLE IF NOT EXISTS exec_queue (
  id SERIAL PRIMARY KEY,
  time BIGINT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queue operations
CREATE INDEX IF NOT EXISTS idx_event_queue_time ON event_queue(time);
CREATE INDEX IF NOT EXISTS idx_exec_queue_time ON exec_queue(time);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_waiting_invokes_child ON waiting_invokes(child_run_id);
CREATE INDEX IF NOT EXISTS idx_waiting_invokes_parent ON waiting_invokes(parent_run_id, hashed_op_id);
`;
