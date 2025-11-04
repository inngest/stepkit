import type { Workflow } from "@stepkit/core";
import {
  BaseExecutionDriver,
  createStdStep,
  executeUntilDone,
  stdHashId,
  type Context,
  type InputDefault,
  type OpResult,
  type ReportOp,
  type StateDriver,
  type Step,
  type StripStandardSchema,
} from "@stepkit/core/implementer";

export class InMemoryStateDriver implements StateDriver {
  // private maxAttempts: Record<string, number>;
  // private opAttempts: Record<string, number>;
  private activeRuns: Map<
    string,
    { maxAttempts: number; opAttempts: Record<string, number> }
  >;
  private ops: Map<string, string>;

  constructor() {
    this.activeRuns = new Map();
    this.ops = new Map();
  }

  addRun(runId: string, maxAttempts: number): void {
    this.activeRuns.set(runId, { maxAttempts, opAttempts: {} });
  }

  removeRun(runId: string): void {
    this.activeRuns.delete(runId);
  }

  incrementOpAttempt(runId: string, hashedOpId: string): number {
    const run = this.activeRuns.get(runId);
    if (run === undefined) {
      throw new Error("unreachable: run not found");
    }
    run.opAttempts[hashedOpId] = (run.opAttempts[hashedOpId] ?? 0) + 1;
    return run.opAttempts[hashedOpId];
  }

  getMaxAttempts(runId: string): number {
    const run = this.activeRuns.get(runId);
    if (run === undefined) {
      throw new Error("unreachable: run not found");
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
    const opAttempt = this.incrementOpAttempt(runId, hashedOpId);
    const maxAttempts = this.getMaxAttempts(runId);

    if (op.result.status === "error" && opAttempt < maxAttempts) {
      // Retry by not storing the error
      return;
    }

    const key = this.getKey({ runId, hashedOpId });
    this.ops.set(key, JSON.stringify(op));
  }
}

const stateDriver = new InMemoryStateDriver();

const defaultMaxAttempts = 4;

export class InMemoryDriver extends BaseExecutionDriver {
  constructor() {
    super(stateDriver);
  }

  async getStep(reportOp: ReportOp): Promise<Step> {
    return createStdStep(stdHashId, reportOp);
  }

  async invoke<TInput extends InputDefault, TOutput>(
    workflow: Workflow<TInput, TOutput>,
    input: StripStandardSchema<TInput>
  ): Promise<TOutput> {
    const ctx: Context<TInput> = {
      ext: {},
      input,
      runId: crypto.randomUUID(),
    };
    stateDriver.addRun(ctx.runId, workflow.maxAttempts ?? defaultMaxAttempts);

    try {
      return await executeUntilDone(
        (ctx, workflow) => this.execute(workflow, ctx),
        workflow,
        ctx
      );
    } finally {
      stateDriver.removeRun(ctx.runId);
    }
  }
}
