import {
  disableRetries,
  InvokeTimeoutError,
  StdOpCode,
  toJsonError,
  type OpResult,
  type OpResults,
} from "@stepkit/sdk-tools";

import type {
  InvokeManager,
  LocalStateDriver,
  ResumeInvokeWorkflowOpOpts,
  ResumeWaitForSignalOpOpts,
  Run,
  WaitingInvoke,
  WaitingSignal,
} from "../common/stateDriver";
import { UnreachableError } from "../common/utils";

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
      hashedOpId: invoke.op.id.hashed,
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
        hashedOpId: waitingInvoke.op.id.hashed,
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

export class InMemoryStateDriver implements LocalStateDriver {
  private ops: Map<string, string>;
  private runs: Map<string, Run>;
  waitingInvokes: InvokeManager;
  private waitingSignals: Map<string, WaitingSignal>;

  constructor() {
    this.ops = new Map();
    this.runs = new Map();
    this.waitingInvokes = new InMemoryInvokeManager();
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

  async resumeInvokeWorkflowOp({
    childRunId,
    op,
  }: ResumeInvokeWorkflowOpOpts): Promise<WaitingInvoke | null> {
    const waitingInvoke = await this.waitingInvokes.popByChildRun(childRunId);
    if (waitingInvoke === null) {
      return null;
    }

    if (op.result.status === "error") {
      op.result.error = disableRetries(op.result.error);
    }

    const opResult: OpResults["invokeWorkflow"] = {
      config: waitingInvoke.op.config,
      id: waitingInvoke.op.id,
      result: op.result,
    };
    const key = this.getOpKey({
      hashedOpId: waitingInvoke.op.id.hashed,
      runId: waitingInvoke.parentRun.runId,
    });
    this.ops.set(key, JSON.stringify(opResult));
    return waitingInvoke;
  }

  async timeoutInvokeWorkflowOp({
    hashedOpId,
    runId,
  }: {
    hashedOpId: string;
    runId: string;
  }): Promise<void> {
    const waitingInvoke = await this.waitingInvokes.popByParentOp({
      hashedOpId,
      runId,
    });
    if (waitingInvoke === null) {
      return;
    }

    const error = new InvokeTimeoutError({
      childRunId: waitingInvoke.childRun.runId,
    });

    const opResult: OpResults["invokeWorkflow"] = {
      config: waitingInvoke.op.config,
      id: waitingInvoke.op.id,
      result: {
        status: "error",
        error: toJsonError(error),
      },
    };
    const key = this.getOpKey({
      hashedOpId: waitingInvoke.op.id.hashed,
      runId: waitingInvoke.parentRun.runId,
    });
    this.ops.set(key, JSON.stringify(opResult));
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
    await this.setOp(
      {
        force: true,
        hashedOpId: waitingSignal.op.id.hashed,
        runId: waitingSignal.runId,
      },
      opResult
    );
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
    await this.setOp(
      {
        force: true,
        hashedOpId: waitingSignal.op.id.hashed,
        runId: waitingSignal.runId,
      },
      opResult
    );
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
    {
      force = false,
      hashedOpId,
      runId,
    }: { force: boolean; hashedOpId: string; runId: string },
    op: OpResult
  ): Promise<void> {
    if (
      op.config.code === StdOpCode.invokeWorkflow ||
      op.config.code === StdOpCode.sleep ||
      op.config.code === StdOpCode.waitForSignal
    ) {
      if (!force) {
        return;
      }
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
