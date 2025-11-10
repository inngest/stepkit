import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { Context, ExtDefault, InputDefault, Step } from "./types";

type CronTrigger = {
  type: "cron";
  schedule: string;
};

export function cronTrigger(schedule: string): CronTrigger {
  return { type: "cron", schedule };
}

type EventTrigger<TData extends InputDefault = InputDefault> = {
  type: "event";
  name: string;
  schema?: StandardSchemaV1<TData>;
};

export function eventTrigger<TData extends InputDefault = InputDefault>(
  name: string,
  schema?: StandardSchemaV1<TData>
): EventTrigger<TData> {
  return { type: "event", name, schema };
}

export type Trigger<TData extends InputDefault = InputDefault> =
  | CronTrigger
  | EventTrigger<TData>;

//
// Extract the data type from a trigger
type InferTriggerData<T> = T extends EventTrigger<infer TData> ? TData : never;

//
// Extract data types from an array of triggers and union them
type InferTriggersData<T extends readonly Trigger[]> = T extends readonly [
  infer First,
  ...infer Rest extends readonly Trigger[],
]
  ? InferTriggerData<First> | InferTriggersData<Rest>
  : never;

//
// Get input type from triggers (handles single trigger or array)
export type InferInput<T> = T extends readonly Trigger[]
  ? InferTriggersData<T>
  : T extends Trigger
    ? InferTriggerData<T>
    : InputDefault;

export class Workflow<
  TInput extends InputDefault = InputDefault,
  TOutput = unknown,
  TCfgExt extends ExtDefault = ExtDefault,
  TCtxExt extends ExtDefault = ExtDefault,
  TStepExt extends ExtDefault = ExtDefault,
> {
  readonly client: Client<TCfgExt, TCtxExt, TStepExt>;
  readonly ext: TCfgExt | undefined;
  readonly id: string;
  readonly inputSchema: StandardSchemaV1<TInput> | undefined;
  readonly handler: (
    ctx: Context<TInput, TCtxExt>,
    step: Step<TStepExt>
  ) => Promise<TOutput>;
  readonly maxAttempts?: number;
  readonly triggers?: Trigger[];

  constructor({
    client,
    ext,
    handler,
    id,
    inputSchema,
    maxAttempts,
    triggers,
  }: {
    client: Client<TCfgExt, TCtxExt, TStepExt>;
    ext?: TCfgExt;
    handler: (
      ctx: Context<TInput, TCtxExt>,
      step: Step<TStepExt>
    ) => Promise<TOutput>;
    id: string;
    inputSchema?: StandardSchemaV1<TInput>;
    maxAttempts?: number;
    triggers?: Trigger[];
  }) {
    this.client = client;
    this.ext = ext;
    this.handler = handler;
    this.id = id;
    this.inputSchema = inputSchema;
    this.maxAttempts = maxAttempts;
    this.triggers = triggers;
  }

  async start(input: TInput): Promise<StartData> {
    return this.client.startWorkflow(this, input);
  }
}

export type Client<
  TWorkflowCfgExt extends ExtDefault = ExtDefault,
  TCtxExt extends ExtDefault = ExtDefault,
  TStepExt extends ExtDefault = ExtDefault,
> = {
  workflow: {
    //
    // Overload 1: when triggers are provided, infer TInput from them
    <
      TTriggers extends readonly Trigger[] | Trigger,
      TInput extends InputDefault = InferInput<TTriggers>,
      TOutput = unknown,
    >(
      opts: {
        ext?: TWorkflowCfgExt;
        id: string;
        inputSchema?: StandardSchemaV1<TInput>;
        maxAttempts?: number;
        triggers: TTriggers;
      },
      handler: (
        ctx: Context<TInput, TCtxExt>,
        step: Step<TStepExt>
      ) => Promise<TOutput>
    ): Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt>;

    //
    // Overload 2: when inputSchema is provided without triggers, infer from inputSchema
    <TInput extends InputDefault = InputDefault, TOutput = unknown>(
      opts: {
        ext?: TWorkflowCfgExt;
        id: string;
        inputSchema: StandardSchemaV1<TInput>;
        maxAttempts?: number;
        triggers?: Trigger[];
      },
      handler: (
        ctx: Context<TInput, TCtxExt>,
        step: Step<TStepExt>
      ) => Promise<TOutput>
    ): Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt>;

    //
    // Overload 3: fallback when neither triggers nor inputSchema are provided
    <TInput extends InputDefault = InputDefault, TOutput = unknown>(
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
    ): Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt>;
  };

  startWorkflow: <TInput extends InputDefault, TOutput>(
    workflow: Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt>,
    input: TInput
  ) => Promise<StartData>;
};

export type StartData = {
  eventId: string;
  runId: string;
};
