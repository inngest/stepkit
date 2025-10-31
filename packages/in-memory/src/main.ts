import type { RunStateDriver, OpResult, Workflow } from "@open-workflow/core";
import { BaseExecutionDriver } from "@open-workflow/core";
import { StdContext } from "packages/core/src/types";

class State implements RunStateDriver {
  private steps: Map<string, OpResult>;
  constructor() {
    this.steps = new Map();
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
    if (this.steps.has(key)) {
      return this.steps.get(key);
    }
    return undefined;
  }
  setOp(
    { runId, hashedOpId }: { runId: string; hashedOpId: string },
    op: OpResult
  ): void {
    const key = this.getKey({ runId, hashedOpId });
    this.steps.set(key, op);
  }
}

const state = new State();

export class InMemoryDriver extends BaseExecutionDriver {
  async execute(workflow: Workflow<StdContext, any>) {
    return super.execute(workflow);
  }
}
