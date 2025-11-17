import type { StandardSchemaV1 } from "@standard-schema/spec";

import { Workflow, type Trigger } from "@stepkit/core";
import type {
  Client,
  Context,
  ExtDefault,
  InputDefault,
  SendSignalOpts,
  StartData,
  Step,
} from "@stepkit/core/implementer";

export abstract class BaseClient<
  TWorkflowCfgExt extends ExtDefault = ExtDefault,
  TCtxExt extends ExtDefault = ExtDefault,
  TStepExt extends ExtDefault = ExtDefault,
> implements Client<TWorkflowCfgExt, TCtxExt, TStepExt>
{
  workflows: Map<
    string,
    Workflow<any, any, TWorkflowCfgExt, TCtxExt, TStepExt>
  >;

  constructor() {
    this.workflows = new Map();
  }

  abstract sendSignal(opts: SendSignalOpts): Promise<{ runId: string | null }>;

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
      client: this,
      handler,
    });
    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  abstract startWorkflow<TInput extends InputDefault, TOutput>(
    workflow: Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt>,
    input: TInput
  ): Promise<StartData>;
}
