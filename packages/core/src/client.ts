import type { ExecutionDriver } from "./executionDriver";
import type { Context, ExtDefault, InputDefault, Step } from "./types";
import { Workflow } from "./workflow";

export class StepKitClient<
  TCtxExt extends ExtDefault = ExtDefault,
  TStepExt extends ExtDefault = ExtDefault,
> {
  private readonly driver: ExecutionDriver<TCtxExt, TStepExt>;

  constructor({ driver }: { driver: ExecutionDriver<TCtxExt, TStepExt> }) {
    this.driver = driver;
  }

  workflow<TInput extends InputDefault = InputDefault, TOutput = unknown>(
    opts: {
      id: string;
      maxAttempts?: number;
      inputSchema?: TInput;
    },
    handler: (
      ctx: Context<TInput, TCtxExt>,
      step: Step<TStepExt>
    ) => Promise<TOutput>
  ): Workflow<TInput, TOutput, TCtxExt, TStepExt> {
    return new Workflow<TInput, TOutput, TCtxExt, TStepExt>({
      ...opts,
      driver: this.driver,
      handler,
    });
  }
}
