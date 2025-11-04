import type { ExecutionDriver } from "./executionDriver";
import type { Context, ExtDefault, InputDefault, Step } from "./types";
import { Workflow, type Trigger } from "./workflow";

export class StepKitClient<
  TWorkflowCfgExt extends ExtDefault = ExtDefault,
  TCtxExt extends ExtDefault = ExtDefault,
  TStepExt extends ExtDefault = ExtDefault,
> {
  private readonly driver: ExecutionDriver<TWorkflowCfgExt, TCtxExt, TStepExt>;

  constructor({
    driver,
  }: {
    driver: ExecutionDriver<TWorkflowCfgExt, TCtxExt, TStepExt>;
  }) {
    this.driver = driver;
  }

  workflow<TInput extends InputDefault = InputDefault, TOutput = unknown>(
    opts: {
      ext?: TWorkflowCfgExt;
      id: string;
      inputSchema?: TInput;
      maxAttempts?: number;
      triggers?: Trigger[];
    },
    handler: (
      ctx: Context<TInput, TCtxExt>,
      step: Step<TStepExt>
    ) => Promise<TOutput>
  ): Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt> {
    return new Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt>({
      ...opts,
      driver: this.driver,
      handler,
    });
  }
}
