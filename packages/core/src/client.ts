import type { ExecutionDriver } from "./executionDriver";
import type { Context, ExtDefault, InputDefault, Step } from "./types";
import { Workflow } from "./workflow";

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
      id: string;
      ext?: TWorkflowCfgExt;
      maxAttempts?: number;
      inputSchema?: TInput;
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
