import { OpMode, type OpResult } from "@stepkit/sdk-tools";

import { UnreachableError } from "../common/errors";
import type {
  InvokeManager,
  LocalStateDriver,
  Run,
  SignalManager,
  WaitingInvoke,
  WaitingSignal,
} from "../common/stateDriver";

class InMemoryInvokeManager implements InvokeManager {
  private byChildRun: Map<string, WaitingInvoke>;
  private byParentOp: Map<string, WaitingInvoke>;

  constructor() {
    this.byChildRun = new Map();
    this.byParentOp = new Map();
  }

  private getParentOpKey({
    hashedOpId,
    runId,
  }: {
    hashedOpId: string;
    runId: string;
  }): string {
    return `${runId}:${hashedOpId}`;
  }

  async add(invoke: WaitingInvoke): Promise<void> {
    const key = this.getParentOpKey({
      hashedOpId: invoke.op.opId.hashed,
      runId: invoke.parentRun.runId,
    });
    if (this.byParentOp.has(key)) {
      throw new Error("waiting invoke already exists");
    }
    this.byParentOp.set(key, invoke);
    this.byChildRun.set(invoke.childRun.runId, invoke);
  }

  async popByChildRun(runId: string): Promise<WaitingInvoke | null> {
    const waitingInvoke = this.byChildRun.get(runId);
    if (waitingInvoke === undefined) {
      return null;
    }
    this.byChildRun.delete(runId);
    this.byParentOp.delete(
      this.getParentOpKey({
        hashedOpId: waitingInvoke.op.opId.hashed,
        runId: waitingInvoke.parentRun.runId,
      })
    );
    return waitingInvoke;
  }

  async popByParentOp({
    hashedOpId,
    runId,
  }: {
    hashedOpId: string;
    runId: string;
  }): Promise<WaitingInvoke | null> {
    const key = this.getParentOpKey({ hashedOpId, runId });
    const waitingInvoke = this.byParentOp.get(key);
    if (waitingInvoke === undefined) {
      return null;
    }
    this.byParentOp.delete(key);
    this.byChildRun.delete(waitingInvoke.childRun.runId);
    return waitingInvoke;
  }
}

class InMemorySignalManager implements SignalManager {
  private signals: Map<string, WaitingSignal>;
  constructor() {
    this.signals = new Map();
  }

  async add(signal: WaitingSignal): Promise<void> {
    if (this.signals.has(signal.op.config.options.signal)) {
      throw new Error("waiting signal already exists");
    }
    this.signals.set(signal.op.config.options.signal, signal);
  }

  async pop(signal: string): Promise<WaitingSignal | null> {
    const waitingSignal = this.signals.get(signal);
    if (waitingSignal === undefined) {
      return null;
    }
    this.signals.delete(signal);
    return waitingSignal;
  }
}

export class InMemoryStateDriver implements LocalStateDriver {
  private ops: Map<string, string>;
  private runs: Map<string, Run>;
  waitingInvokes: InvokeManager;
  waitingSignals: InMemorySignalManager;

  constructor() {
    this.ops = new Map();
    this.runs = new Map();
    this.waitingInvokes = new InMemoryInvokeManager();
    this.waitingSignals = new InMemorySignalManager();
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
    { hashedOpId, runId }: { hashedOpId: string; runId: string },
    op: OpResult
  ): Promise<void> {
    if (op.config.mode === OpMode.scheduled) {
      // Don't store because future work will be scheduled via the queue
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

    const key = this.getOpKey({ runId, hashedOpId });
    this.ops.set(key, JSON.stringify(op));
  }
}
