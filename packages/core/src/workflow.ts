import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { Context, ExtDefault, InputDefault, Step } from "./types";

type CronTrigger = {
  type: "cron";
  schedule: string;
};

export function cronTrigger(schedule: string): CronTrigger {
  return { type: "cron", schedule };
}

type EventTrigger = {
  type: "event";
  name: string;
};

export function eventTrigger(name: string): EventTrigger {
  return { type: "event", name };
}

export type Trigger = CronTrigger | EventTrigger;

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
  workflow: <TInput extends InputDefault = InputDefault, TOutput = unknown>(
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
  ) => Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt>;

  startWorkflow: <TInput extends InputDefault, TOutput>(
    workflow: Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt>,
    input: TInput
  ) => Promise<StartData>;
};

export type StartData = {
  eventId: string;
  runId: string;
};
