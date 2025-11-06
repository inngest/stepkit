import type { Context, Input, OpResult, StateDriver } from "@stepkit/sdk-tools";

type Run = {
  ctx: Context<any, any>;
  maxAttempts: number;
  opAttempts: Record<string, number>;
  output: unknown;
  workflowId: string;
};

export class InMemoryStateDriver implements StateDriver {
  private activeRuns: Set<string>;
  private ops: Map<string, string>;
  private runs: Map<string, Run>;
  private unprocessedEvents: Map<string, Input<any, "event">>;

  constructor() {
    this.activeRuns = new Set();
    this.ops = new Map();
    this.runs = new Map();
    this.unprocessedEvents = new Map();
  }

  getUnprocessedEvents(): Input<any, "event">[] {
    return Array.from(this.unprocessedEvents.values());
  }

  addEvent(event: Input<any, "event">): void {
    this.unprocessedEvents.set(event.id, event);
  }

  removeEvent(eventId: string): void {
    this.unprocessedEvents.delete(eventId);
  }

  getActiveRuns(): Run[] {
    const runs = [];
    for (const runId of this.activeRuns) {
      const run = this.runs.get(runId);
      if (run === undefined) {
        console.error(`unreachable: run not found: ${runId}`);
        continue;
      }
      runs.push(run);
    }
    return runs;
  }

  addRun(run: Run): void {
    this.activeRuns.add(run.ctx.runId);
    this.runs.set(run.ctx.runId, run);
  }

  endRun(runId: string): void {
    this.activeRuns.delete(runId);
  }

  incrementOpAttempt(runId: string, hashedOpId: string): number {
    const run = this.runs.get(runId);
    if (run === undefined) {
      throw new Error("unreachable: run not found");
    }
    run.opAttempts[hashedOpId] = (run.opAttempts[hashedOpId] ?? 0) + 1;
    return run.opAttempts[hashedOpId];
  }

  getMaxAttempts(runId: string): number {
    const run = this.runs.get(runId);
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
