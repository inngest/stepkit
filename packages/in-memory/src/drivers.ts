import type { Workflow } from "@stepkit/core";
import {
  BaseExecutionDriver,
  createStdStep,
  executeUntilDone,
  stdHashId,
  type InputDefault,
  type OpResult,
  type ReportOp,
  type StateDriver,
  type StdContext,
  type StdStep,
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

export class InMemoryDriver extends BaseExecutionDriver {
  private activeRuns: Set<string>;

  constructor() {
    super(stateDriver);
    this.activeRuns = new Set();
  }

  async getSteps(reportOp: ReportOp): Promise<StdStep> {
    return createStdStep(stdHashId, reportOp);
  }

  override async invoke<TInput extends InputDefault, TOutput>(
    workflow: Workflow<TInput, TOutput, StdContext<TInput>>,
    input: StripStandardSchema<TInput>
  ): Promise<TOutput> {
    const ctx: StdContext<TInput> = {
      input: [input],
      runId: crypto.randomUUID(),
    };
    stateDriver.addRun(ctx.runId, workflow.maxAttempts);

    try {
      return await executeUntilDone(
        (ctx, workflow) => this.execute(workflow, ctx),
        workflow,
        ctx
      );
    } finally {
      // this.activeRuns.delete(ctx.runId);
      stateDriver.removeRun(ctx.runId);
    }
  }
}
