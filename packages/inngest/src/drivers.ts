import type { Workflow } from "@stepkit/core";
import {
  BaseExecutionDriver,
  StdOpCode,
  createStdStep,
  createOpFound,
  ReportOp,
  StdContext,
  StdStep,
  RunStateDriver,
  OpResult,
} from "@stepkit/core/implementer";

export class InngestRunStateDriver implements RunStateDriver<StdContext> {
  private ops: Map<string, OpResult>;

  constructor() {
    this.ops = new Map();
  }

  async getContext(runId: string): Promise<Omit<StdContext, "step">> {
    return { runId };
  }

  private createOpKey({
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
    const key = this.createOpKey({ runId, hashedOpId });
    if (this.ops.has(key)) {
      return this.ops.get(key);
    }
    return undefined;
  }
  setOp(
    { runId, hashedOpId }: { runId: string; hashedOpId: string },
    op: OpResult
  ): void {
    const key = this.createOpKey({ runId, hashedOpId });
    this.ops.set(key, op);
  }
}

const stateDriver = new InngestRunStateDriver();

export type Step = StdStep & {
  sleepUntil: (stepId: string, wakeupAt: Date) => Promise<void>;
};

export class InngestDriver extends BaseExecutionDriver<StdContext, Step> {
  private activeRuns: Set<string>;

  constructor() {
    super(stateDriver);
    this.activeRuns = new Set();
  }

  async execute(workflow: Workflow<StdContext, Step, any>, runId: string) {
    return super.execute(workflow, runId);
  }

  async getSteps(reportOp: ReportOp): Promise<Step> {
    return {
      ...createStdStep(reportOp),
      sleepUntil: async (stepId: string, wakeupAt: Date) => {
        return await createOpFound(reportOp, stepId, {
          code: StdOpCode.sleep,
          options: { wakeupAt },
        });
      },
    };
  }

  async invoke<TOutput>(
    workflow: Workflow<StdContext, Step, TOutput>
  ): Promise<TOutput> {
    const runId = crypto.randomUUID();
    this.activeRuns.add(runId);

    let i = 0;
    let maxIterations = 10_000;
    while (true) {
      i++;
      if (i > maxIterations) {
        throw new Error("unreachable: infinite loop detected");
      }

      const ops = await this.execute(workflow, runId);
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
