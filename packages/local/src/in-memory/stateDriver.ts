import { StdOpCode, type Context, type OpResult } from "@stepkit/sdk-tools";

import type { LocalStateDriver } from "../common/stateDriver";
import { UnreachableError } from "./utils";

export type Run = {
  ctx: Context<any, any>;
  maxAttempts: number;
  opAttempts: Record<string, number>;
  result: OpResult["result"] | undefined;
  workflowId: string;
};

export class InMemoryStateDriver implements LocalStateDriver {
  private ops: Map<string, string>;
  private runs: Map<string, Run>;

  constructor() {
    this.ops = new Map();
    this.runs = new Map();
  }

  async addRun(run: Run): Promise<void> {
    this.runs.set(run.ctx.runId, run);
  }

  async getRun(runId: string): Promise<Run | undefined> {
    return this.runs.get(runId);
  }

  async endRun(runId: string, op: OpResult): Promise<void> {
    const run = this.runs.get(runId);
    if (run === undefined) {
      throw new UnreachableError("run not found");
    }
    run.result = op.result;
  }

  async incrementOpAttempt(runId: string, hashedOpId: string): Promise<number> {
    const run = this.runs.get(runId);
    if (run === undefined) {
      throw new UnreachableError("run not found");
    }
    run.opAttempts[hashedOpId] = (run.opAttempts[hashedOpId] ?? 0) + 1;
    return run.opAttempts[hashedOpId];
  }

  async getMaxAttempts(runId: string): Promise<number> {
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

  async getOp({
    runId,
    hashedOpId,
  }: {
    runId: string;
    hashedOpId: string;
  }): Promise<OpResult | undefined> {
    const key = this.getKey({ runId, hashedOpId });
    const value = this.ops.get(key);
    if (value !== undefined) {
      const result: unknown = JSON.parse(value);

      // @ts-expect-error - Necessary because of generics
      return result;
    }
    return undefined;
  }

  async setOp(
    { runId, hashedOpId }: { runId: string; hashedOpId: string },
    op: OpResult
  ): Promise<void> {
    if (op.config.code === StdOpCode.sleep) {
      return;
    }

    const opAttempt = await this.incrementOpAttempt(runId, hashedOpId);
    const maxAttempts = await this.getMaxAttempts(runId);

    if (op.result.status === "error" && opAttempt < maxAttempts) {
      // Retry by not storing the error
      return;
    }

    const key = this.getKey({ runId, hashedOpId });
    this.ops.set(key, JSON.stringify(op));
  }

  async wakeSleepOp(
    { runId, hashedOpId }: { runId: string; hashedOpId: string },
    op: OpResult
  ): Promise<void> {
    if (op.config.code !== StdOpCode.sleep) {
      throw new UnreachableError("op is not a sleep");
    }

    const key = this.getKey({ runId, hashedOpId });
    this.ops.set(key, JSON.stringify(op));
  }
}
