import {
  BaseClient,
  type ExtDefault,
  type InputDefault,
  type SendSignalOpts,
  type StartData,
  type Step,
  type Workflow,
} from "@stepkit/sdk-tools";

export type CustomStep = Step<{
  sleepUntil: (stepId: string, wakeAt: Date) => Promise<void>;
}>;

export type StepExt = {
  sleepUntil: (stepId: string, wakeAt: Date) => Promise<void>;
};

export class InngestClient extends BaseClient<ExtDefault, ExtDefault, StepExt> {
  readonly id: string;

  constructor({ id }: { id: string }) {
    super();
    this.id = id;
  }

  sendSignal(_opts: SendSignalOpts): Promise<{ runId: string | null }> {
    throw new Error("not implemented");
  }

  startWorkflow<TInput extends InputDefault>(
    _workflow: Workflow<TInput, any, ExtDefault, ExtDefault, StepExt>,
    _input: TInput
  ): Promise<StartData> {
    throw new Error("not implemented");
  }
}
