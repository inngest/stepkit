import type { RunStateDriver, OpResult, Workflow } from "@open-workflow/core";
import { BaseExecutionDriver } from "@open-workflow/core";
import { BaseContext, StdContext } from "packages/core/src/types";

export class InngestRunStateDriver implements RunStateDriver {
  private ops: Map<string, OpResult>;

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

const stateDriver = new InngestRunStateDriver();

type CommResponse = {};

function toCommResponse(ops: OpResult[]): CommResponse {
  return ops;
}

export class InngestDriver extends BaseExecutionDriver {
  private activeRuns: Set<string>;

  constructor() {
    super(stateDriver);
    this.activeRuns = new Set();
  }

  async execute(
    workflow: Workflow<StdContext, any>,
    baseContext: BaseContext<StdContext>
  ) {
    return super.execute(workflow, baseContext);
  }

  async invoke<TOutput>(
    workflow: Workflow<StdContext, TOutput>
  ): Promise<TOutput> {
    const runId = crypto.randomUUID();
    this.activeRuns.add(runId);
    const baseContext: BaseContext<StdContext> = {
      runId,
    };

    let i = 0;
    let maxIterations = 10_000;
    while (true) {
      i++;
      if (i > maxIterations) {
        throw new Error("unreachable: infinite loop detected");
      }

      const ops = await this.execute(workflow, baseContext);
      if (ops.length !== 1) {
        // Not done yet
        continue;
      }
      const op = ops[0];
      if (op.config.code !== "workflow") {
        // Not done yet
        continue;
      }

      try {
        if (op.result.status !== "success") {
          throw op.result.error;
        }

        // @ts-expect-error
        return op.result.output;
      } catch (e) {
        throw e;
      } finally {
        this.activeRuns.delete(runId);
      }
    }
  }
}
