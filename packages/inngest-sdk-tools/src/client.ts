import {
  BaseClient,
  createOpFound,
  createStdStep,
  StdOpCode,
  type ExtDefault,
  type InputDefault,
  type ReportOp,
  type StartData,
  type Step,
  type Workflow,
} from "@stepkit/sdk-tools";

export type CustomStep = Step<{
  sleepUntil: (stepId: string, wakeupAt: Date) => Promise<void>;
}>;

export type StepExt = {
  sleepUntil: (stepId: string, wakeupAt: Date) => Promise<void>;
};

export class InngestClient extends BaseClient<ExtDefault, ExtDefault, StepExt> {
  readonly id: string;

  constructor({ id }: { id: string }) {
    super();
    this.id = id;
  }

  async getStep(reportOp: ReportOp): Promise<Step<StepExt>> {
    return {
      ...createStdStep(reportOp),
      ext: {
        sleepUntil: async (stepId: string, wakeupAt: Date) => {
          await createOpFound(reportOp, stepId, {
            code: StdOpCode.sleep,
            options: { wakeupAt },
          });
        },
      },
    };
  }

  startWorkflow<TInput extends InputDefault>(
    _workflow: Workflow<TInput, any, ExtDefault, ExtDefault, StepExt>,
    _input: TInput
  ): Promise<StartData> {
    throw new Error("not implemented");
  }
}
