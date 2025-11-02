import type { Workflow } from "@stepkit/core";
import type {
  RunStateDriver,
  OpResult,
  StdContext,
  StdStep,
} from "@stepkit/core/implementer";
import {
  BaseExecutionDriver,
  executeUntilDone,
} from "@stepkit/core/implementer";

export class InMemoryRunStateDriver implements RunStateDriver {
  private ops: Map<string, OpResult>;

  constructor() {
    this.ops = new Map();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getContext(runId: string): Promise<Omit<StdContext, "step">> {
    return { runId };
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
    if (this.ops.has(key)) {
      return this.ops.get(key);
    }
    return undefined;
  }
  setOp(
    { runId, hashedOpId }: { runId: string; hashedOpId: string },
    op: OpResult
  ): void {
    const key = this.getKey({ runId, hashedOpId });
    this.ops.set(key, op);
  }
}

const stateDriver = new InMemoryRunStateDriver();

export class InMemoryDriver extends BaseExecutionDriver {
  private activeRuns: Set<string>;

  constructor() {
    super(stateDriver);
    this.activeRuns = new Set();
  }

  async invoke<TOutput>(
    workflow: Workflow<StdContext, StdStep, TOutput>
  ): Promise<TOutput> {
    const runId = crypto.randomUUID();
    this.activeRuns.add(runId);

    try {
      return await executeUntilDone(this, workflow, runId);
    } finally {
      this.activeRuns.delete(runId);
    }
  }
}
