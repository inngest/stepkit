import type pg from "pg";

import { singleFlight, type OpMode, type OpResult } from "@stepkit/sdk-tools";

import { UnreachableError } from "../common/errors";
import type {
  InvokeManager,
  LocalStateDriver,
  Run,
  SignalManager,
  WaitingInvoke,
  WaitingSignal,
} from "../common/stateDriver";

class PostgresInvokeManager implements InvokeManager {
  constructor(private pool: pg.Pool) {}

  async add(invoke: WaitingInvoke): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Check if already exists
      const checkResult = await client.query(
        `SELECT 1 FROM waiting_invokes WHERE parent_run_id = $1 AND hashed_op_id = $2`,
        [invoke.parentRun.runId, invoke.op.opId.hashed]
      );

      if (checkResult.rows.length > 0) {
        throw new Error("waiting invoke already exists");
      }

      await client.query(
        `INSERT INTO waiting_invokes (child_run_id, parent_run_id, hashed_op_id, invoke_data)
         VALUES ($1, $2, $3, $4)`,
        [
          invoke.childRun.runId,
          invoke.parentRun.runId,
          invoke.op.opId.hashed,
          JSON.stringify(invoke),
        ]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async popByChildRun(runId: string): Promise<WaitingInvoke | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<{ invoke_data: WaitingInvoke }>(
        `DELETE FROM waiting_invokes WHERE child_run_id = $1 RETURNING invoke_data`,
        [runId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      if (row === undefined) {
        return null;
      }

      return row.invoke_data;
    } finally {
      client.release();
    }
  }

  async popByParentOp({
    hashedOpId,
    runId,
  }: {
    hashedOpId: string;
    runId: string;
  }): Promise<WaitingInvoke | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<{ invoke_data: WaitingInvoke }>(
        `DELETE FROM waiting_invokes WHERE parent_run_id = $1 AND hashed_op_id = $2 RETURNING invoke_data`,
        [runId, hashedOpId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      if (row === undefined) {
        return null;
      }

      return row.invoke_data;
    } finally {
      client.release();
    }
  }
}

class PostgresSignalManager implements SignalManager {
  constructor(private pool: pg.Pool) {}

  async add(signal: WaitingSignal): Promise<void> {
    const signalName = signal.op.config.options.signal;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Check if already exists
      const checkResult = await client.query(
        `SELECT 1 FROM waiting_signals WHERE signal_name = $1`,
        [signalName]
      );

      if (checkResult.rows.length > 0) {
        throw new Error("waiting signal already exists");
      }

      await client.query(
        `INSERT INTO waiting_signals (signal_name, signal_data) VALUES ($1, $2)`,
        [signalName, JSON.stringify(signal)]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async pop(signal: string): Promise<WaitingSignal | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<{ signal_data: WaitingSignal }>(
        `DELETE FROM waiting_signals WHERE signal_name = $1 RETURNING signal_data`,
        [signal]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      if (row === undefined) {
        return null;
      }

      return row.signal_data;
    } finally {
      client.release();
    }
  }
}

export class PostgresStateDriver implements LocalStateDriver {
  waitingInvokes: PostgresInvokeManager;
  waitingSignals: PostgresSignalManager;

  constructor(private pool: pg.Pool) {
    this.waitingInvokes = new PostgresInvokeManager(pool);
    this.waitingSignals = new PostgresSignalManager(pool);
  }

  async addRun(run: Run): Promise<void> {
    await this.pool.query(
      `INSERT INTO runs (run_id, workflow_id, ctx, max_attempts, op_attempts, result)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (run_id) DO UPDATE SET
         workflow_id = EXCLUDED.workflow_id,
         ctx = EXCLUDED.ctx,
         max_attempts = EXCLUDED.max_attempts,
         op_attempts = EXCLUDED.op_attempts,
         result = EXCLUDED.result,
         updated_at = NOW()`,
      [
        run.ctx.runId,
        run.workflowId,
        JSON.stringify(run.ctx),
        run.maxAttempts,
        JSON.stringify(run.opAttempts),
        run.result !== undefined ? JSON.stringify(run.result) : null,
      ]
    );
  }

  async getRun(runId: string): Promise<Run | undefined> {
    try {
      const result = await this.pool.query<{
        ctx: Run["ctx"];
        forced_op_mode: Run["forcedOpMode"];
        max_attempts: number;
        op_attempts: Record<string, number>;
        result: Run["result"];
        workflow_id: string;
      }>(
        `SELECT workflow_id, ctx, max_attempts, op_attempts, result, forced_op_mode
      FROM runs
      WHERE run_id = $1`,
        [runId]
      );

      if (result.rows.length === 0) {
        return undefined;
      }

      const row = result.rows[0];
      if (row === undefined) {
        return undefined;
      }

      return {
        ctx: row.ctx,
        forcedOpMode: row.forced_op_mode,
        maxAttempts: row.max_attempts,
        opAttempts: row.op_attempts,
        result: nullToUndefined(row.result),
        workflowId: row.workflow_id,
      };
    } catch (error) {
      console.error("error getting run", error);
      throw error;
    }
  }

  async endRun(runId: string, op: OpResult): Promise<void> {
    await this.pool.query(
      `UPDATE runs SET result = $1, updated_at = NOW() WHERE run_id = $2`,
      [JSON.stringify(op.result), runId]
    );
  }

  async forceOpMode(
    runId: string,
    hashedOpId: string,
    mode: OpMode
  ): Promise<void> {
    await this.pool.query(
      `UPDATE runs SET forced_op_mode = $1 WHERE run_id = $2`,
      [mode, runId, hashedOpId]
    );
  }

  async incrementOpAttempt(runId: string, hashedOpId: string): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query<{
        op_attempts: Record<string, number>;
      }>(`SELECT op_attempts FROM runs WHERE run_id = $1 FOR UPDATE`, [runId]);

      if (result.rows.length === 0) {
        throw new UnreachableError("run not found");
      }

      const row = result.rows[0];
      if (row === undefined) {
        throw new UnreachableError("run not found");
      }

      const opAttempts = row.op_attempts;
      const newAttemptCount = (opAttempts[hashedOpId] ?? 0) + 1;
      opAttempts[hashedOpId] = newAttemptCount;

      await client.query(
        `UPDATE runs SET op_attempts = $1, updated_at = NOW() WHERE run_id = $2`,
        [JSON.stringify(opAttempts), runId]
      );

      await client.query("COMMIT");

      return newAttemptCount;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getMaxAttempts(runId: string): Promise<number> {
    const result = await this.pool.query<{ max_attempts: number }>(
      `SELECT max_attempts FROM runs WHERE run_id = $1`,
      [runId]
    );

    if (result.rows.length === 0) {
      throw new UnreachableError("run not found");
    }

    const row = result.rows[0];
    if (row === undefined) {
      throw new UnreachableError("run not found");
    }

    return row.max_attempts;
  }

  async getOp({
    runId,
    hashedOpId,
  }: {
    runId: string;
    hashedOpId: string;
  }): Promise<OpResult | undefined> {
    const result = await this.pool.query<{ op_result: OpResult }>(
      `SELECT op_result FROM ops WHERE run_id = $1 AND hashed_op_id = $2`,
      [runId, hashedOpId]
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    const row = result.rows[0];
    if (row === undefined) {
      return undefined;
    }

    return row.op_result;
  }

  async setOp(
    { runId, hashedOpId }: { runId: string; hashedOpId: string },
    op: OpResult
  ): Promise<void> {
    // Check if run exists
    const run = await this.getRun(runId);
    if (run === undefined) {
      // Log instead of error since parallel steps can hit this line
      console.error("unreachable: run not found");
      return;
    }

    if (op.result.status === "error") {
      const opAttempt = await this.incrementOpAttempt(runId, hashedOpId);
      const maxAttempts = await this.getMaxAttempts(runId);

      const canRetry =
        op.result.error.props?.canRetry ?? opAttempt < maxAttempts;
      if (canRetry) {
        // Don't store because retries will be scheduled via the queue
        return;
      }
    }

    await singleFlight(`${runId}:${hashedOpId}`, async () => {
      await this.pool.query(
        `INSERT INTO ops (run_id, hashed_op_id, op_result)
         VALUES ($1, $2, $3)
         ON CONFLICT (run_id, hashed_op_id) DO UPDATE SET
           op_result = EXCLUDED.op_result`,
        [runId, hashedOpId, JSON.stringify(op)]
      );
    });
  }
}

function nullToUndefined<T>(value: T | null): T | undefined {
  if (value === null) {
    return undefined;
  }
  return value;
}
