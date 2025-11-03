import type { Workflow } from "@stepkit/core";
import {
  BaseExecutionDriver,
  createStdStep,
  executeUntilDone,
  stdHashId,
  type OpResult,
  type ReportOp,
  type StateDriver,
  type StdContext,
  type StdStep,
} from "@stepkit/core/implementer";

export class InMemoryStateDriver implements StateDriver {
  private ops: Map<string, string>;

  constructor() {
    this.ops = new Map();
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
    if (op.result.status === "error" && op.result.canRetry) {
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

  async invoke<TInput extends Record<string, unknown>, TOutput>(
    workflow: Workflow<TInput, TOutput, StdContext<TInput>>,
    input: TInput
  ): Promise<TOutput> {
    const ctx: StdContext<TInput> = {
      attempt: 0,
      input: [input],
      runId: crypto.randomUUID(),
    };
    this.activeRuns.add(ctx.runId);

    try {
      return await executeUntilDone(
        (ctx, workflow) => this.execute(workflow, ctx),
        workflow,
        ctx
      );
    } finally {
      this.activeRuns.delete(ctx.runId);
    }
  }
}
