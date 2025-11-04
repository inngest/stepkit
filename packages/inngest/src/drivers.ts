import {
  BaseExecutionDriver,
  createOpFound,
  createStdStep,
  stdHashId,
  StdOpCode,
  type ExtDefault,
  type OpResult,
  type ReportOp,
  type StateDriver,
  type Step,
} from "@stepkit/core/implementer";

export class InngestStateDriver implements StateDriver {
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

const stateDriver = new InngestStateDriver();

export type CustomStep = Step<{
  sleepUntil: (stepId: string, wakeupAt: Date) => Promise<void>;
}>;

export type StepExt = {
  sleepUntil: (stepId: string, wakeupAt: Date) => Promise<void>;
};

export class InngestDriver extends BaseExecutionDriver<ExtDefault, StepExt> {
  constructor() {
    super(stateDriver);
  }

  async getStep(reportOp: ReportOp): Promise<Step<StepExt>> {
    return {
      ...createStdStep(stdHashId, reportOp),
      ext: {
        sleepUntil: async (stepId: string, wakeupAt: Date) => {
          await createOpFound(stdHashId, reportOp, stepId, {
            code: StdOpCode.sleep,
            options: { wakeupAt },
          });
        },
      },
    };
  }
}
