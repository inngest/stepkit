import {
  BaseExecutionDriver,
  createOpFound,
  createStdStep,
  StdOpCode,
  type OpResult,
  type ReportOp,
  type RunStateDriver,
  type StdContext,
  type StdStep,
} from "@stepkit/core/implementer";

export class InngestRunStateDriver implements RunStateDriver {
  private ops: Map<string, OpResult>;

  constructor() {
    this.ops = new Map();
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
  constructor() {
    super(stateDriver);
  }

  async getSteps(reportOp: ReportOp): Promise<Step> {
    return {
      ...createStdStep(reportOp),
      sleepUntil: async (stepId: string, wakeupAt: Date) => {
        await createOpFound(reportOp, stepId, {
          code: StdOpCode.sleep,
          options: { wakeupAt },
        });
      },
    };
  }
}
