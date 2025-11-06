import type { ExtDefault, InputDefault } from "./types";
import type { StartData, Workflow } from "./workflow";

export type ExecutionDriver<
  TWorkflowCfgExt extends ExtDefault = ExtDefault,
  TCtxExt extends ExtDefault = ExtDefault,
  TStepExt extends ExtDefault = ExtDefault,
> = {
  addWorkflow: (
    workflow: Workflow<any, any, TWorkflowCfgExt, TCtxExt, TStepExt>
  ) => void;

  startWorkflow: <TInput extends InputDefault, TOutput>(
    workflow: Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt>,
    input: TInput
  ) => Promise<StartData>;
};
