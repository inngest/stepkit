import {
  StdOpCode,
  type Context,
  type OpResult,
  type StateDriver,
} from "@stepkit/sdk-tools";

import { UnreachableError } from "./utils";

export type Run = {
  ctx: Context<any, any>;
  maxAttempts: number;
  opAttempts: Record<string, number>;
  result: OpResult["result"] | undefined;
  workflowId: string;
};

export class InMemoryStateDriver implements StateDriver {
  private ops: Map<string, string>;
  private runs: Map<string, Run>;

  constructor() {
    this.ops = new Map();
    this.runs = new Map();
  }

  addRun(run: Run): void {
    this.runs.set(run.ctx.runId, run);
  }

  getRun(runId: string): Run | undefined {
    return this.runs.get(runId);
  }

  endRun(runId: string, op: OpResult): void {
    const run = this.runs.get(runId);
    if (run === undefined) {
      throw new UnreachableError("run not found");
    }
    run.result = op.result;
  }

  incrementOpAttempt(runId: string, hashedOpId: string): number {
    const run = this.runs.get(runId);
    if (run === undefined) {
      throw new UnreachableError("run not found");
    }
    run.opAttempts[hashedOpId] = (run.opAttempts[hashedOpId] ?? 0) + 1;
    return run.opAttempts[hashedOpId];
  }

  getMaxAttempts(runId: string): number {
    const run = this.runs.get(runId);
    if (run === undefined) {
      throw new UnreachableError("run not found");
    }
    return run.maxAttempts;
  }

  private getKey({
    runId,
    hashedOpId,
  }: {
    runId: string;
    hashedOpId: string;
  }): string {
    return `${runId}:${hashedOpId}`;
  }

  getOp({
    runId,
    hashedOpId,
  }: {
    runId: string;
    hashedOpId: string;
  }): OpResult | undefined {
    const key = this.getKey({ runId, hashedOpId });
    const value = this.ops.get(key);
    if (value !== undefined) {
      return JSON.parse(value) as OpResult;
    }
    return undefined;
  }

  setOp(
    { runId, hashedOpId }: { runId: string; hashedOpId: string },
    op: OpResult
  ): void {
    if (op.config.code === StdOpCode.sleep) {
      return;
    }

    const opAttempt = this.incrementOpAttempt(runId, hashedOpId);
    const maxAttempts = this.getMaxAttempts(runId);

    if (op.result.status === "error" && opAttempt < maxAttempts) {
      // Retry by not storing the error
      return;
    }

    const key = this.getKey({ runId, hashedOpId });
    this.ops.set(key, JSON.stringify(op));
  }

  wakeSleepOp(
    { runId, hashedOpId }: { runId: string; hashedOpId: string },
    op: OpResult
  ): void {
    if (op.config.code !== StdOpCode.sleep) {
      throw new UnreachableError("op is not a sleep");
    }

    const key = this.getKey({ runId, hashedOpId });
    this.ops.set(key, JSON.stringify(op));
  }
}
