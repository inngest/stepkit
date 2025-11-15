import { StdOpCode, type OpResult, type OpResults } from "@stepkit/sdk-tools";

import type {
  LocalStateDriver,
  ResumeWaitForSignalOpOpts,
  Run,
  WaitingSignal,
} from "../common/stateDriver";
import { UnreachableError } from "../common/utils";

export class InMemoryStateDriver implements LocalStateDriver {
  private ops: Map<string, string>;
  private runs: Map<string, Run>;
  private waitingSignals: Map<string, WaitingSignal>;

  constructor() {
    this.ops = new Map();
    this.runs = new Map();
    this.waitingSignals = new Map();
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

  async addWaitingSignal(signal: WaitingSignal): Promise<void> {
    if (this.waitingSignals.has(signal.op.config.options.signal)) {
      throw new Error("waiting signal already exists");
    }
    this.waitingSignals.set(signal.op.config.options.signal, signal);
  }

  async popWaitingSignal(signal: string): Promise<WaitingSignal | null> {
    const waitingSignal = this.waitingSignals.get(signal);
    if (waitingSignal === undefined) {
      return null;
    }
    this.waitingSignals.delete(signal);
    return waitingSignal;
  }

  async resumeWaitForSignalOp({
    data,
    waitingSignal,
  }: ResumeWaitForSignalOpOpts): Promise<void> {
    const opResult: OpResults["waitForSignal"] = {
      config: {
        code: StdOpCode.waitForSignal,
        options: waitingSignal.op.config.options,
      },
      id: waitingSignal.op.id,
      result: {
        status: "success",
        output: {
          data,
          signal: waitingSignal.op.config.options.signal,
        },
      },
    };
    const key = this.getOpKey({
      hashedOpId: waitingSignal.op.id.hashed,
      runId: waitingSignal.runId,
    });
    this.ops.set(key, JSON.stringify(opResult));
  }

  async timeoutWaitForSignalOp(signal: string): Promise<void> {
    const waitingSignal = await this.popWaitingSignal(signal);
    if (waitingSignal === null) {
      return;
    }
    const opResult: OpResults["waitForSignal"] = {
      config: {
        code: StdOpCode.waitForSignal,
        options: waitingSignal.op.config.options,
      },
      id: waitingSignal.op.id,
      result: {
        status: "success",
        output: null,
      },
    };
    const key = this.getOpKey({
      hashedOpId: waitingSignal.op.id.hashed,
      runId: waitingSignal.runId,
    });
    this.ops.set(key, JSON.stringify(opResult));
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

  private getOpKey({
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
    const key = this.getOpKey({ runId, hashedOpId });
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
    if (
      op.config.code === StdOpCode.sleep ||
      op.config.code === StdOpCode.waitForSignal
    ) {
      return;
    }

    const opAttempt = await this.incrementOpAttempt(runId, hashedOpId);
    const maxAttempts = await this.getMaxAttempts(runId);

    if (op.result.status === "error" && opAttempt < maxAttempts) {
      // Retry by not storing the error
      return;
    }

    const key = this.getOpKey({ runId, hashedOpId });
    this.ops.set(key, JSON.stringify(op));
  }

  async wakeSleepOp(
    { runId, hashedOpId }: { runId: string; hashedOpId: string },
    op: OpResult
  ): Promise<void> {
    if (op.config.code !== StdOpCode.sleep) {
      throw new UnreachableError("op is not a sleep");
    }

    const key = this.getOpKey({ runId, hashedOpId });
    this.ops.set(key, JSON.stringify(op));
  }
}
