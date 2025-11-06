import { type Workflow } from "@stepkit/core";
import {
  BaseExecutionDriver,
  createOpFound,
  createStdStep,
  stdHashId,
  StdOpCode,
  type ExtDefault,
  type InputSchemaDefault,
  type OpResult,
  type ReportOp,
  type StartData,
  type StateDriver,
  type Step,
  type StripStandardSchema,
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

export class InngestDriver extends BaseExecutionDriver<
  ExtDefault,
  ExtDefault,
  StepExt
> {
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

  startWorkflow<TInput extends InputSchemaDefault>(
    _workflow: Workflow<TInput, any, ExtDefault, ExtDefault, StepExt>,
    _input: StripStandardSchema<TInput>
  ): Promise<StartData> {
    throw new Error("not implemented");
  }
}
