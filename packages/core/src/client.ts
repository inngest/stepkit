import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { ExecutionDriver } from "./executionDriver";
import type { Context, ExtDefault, InputDefault, Step } from "./types";
import { Workflow, type Trigger } from "./workflow";

export class StepKitClient<
  TWorkflowCfgExt extends ExtDefault = ExtDefault,
  TCtxExt extends ExtDefault = ExtDefault,
  TStepExt extends ExtDefault = ExtDefault,
> {
  private readonly driver: ExecutionDriver<TWorkflowCfgExt, TCtxExt, TStepExt>;
  readonly id: string;

  constructor({
    driver,
    id,
  }: {
    driver: ExecutionDriver<TWorkflowCfgExt, TCtxExt, TStepExt>;
    id: string;
  }) {
    this.driver = driver;
    this.id = id;
  }

  workflow<TInput extends InputDefault = InputDefault, TOutput = unknown>(
    opts: {
      ext?: TWorkflowCfgExt;
      id: string;
      inputSchema?: StandardSchemaV1<TInput>;
      maxAttempts?: number;
      triggers?: Trigger[];
    },
    handler: (
      ctx: Context<TInput, TCtxExt>,
      step: Step<TStepExt>
    ) => Promise<TOutput>
  ): Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt> {
    const workflow = new Workflow<
      TInput,
      TOutput,
      TWorkflowCfgExt,
      TCtxExt,
      TStepExt
    >({
      ...opts,
      driver: this.driver,
      handler,
    });
    this.driver.addWorkflow(workflow);
    return workflow;
  }
}
