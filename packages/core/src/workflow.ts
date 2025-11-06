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
  readonly driver: Driver<TCfgExt, TCtxExt, TStepExt>;
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
    driver,
    ext,
    handler,
    id,
    inputSchema,
    maxAttempts,
    triggers,
  }: {
    driver: Driver<TCfgExt, TCtxExt, TStepExt>;
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
    this.driver = driver;
    this.ext = ext;
    this.handler = handler;
    this.id = id;
    this.inputSchema = inputSchema;
    this.maxAttempts = maxAttempts;
    this.triggers = triggers;
  }

  async start(input: TInput): Promise<StartData> {
    return this.driver.startWorkflow(this, input);
  }
}

export type StartData = {
  eventId: string;
  runId: string;
};

// Define here to avoid circular dependency
type Driver<
  TCfgExt extends ExtDefault = ExtDefault,
  TCtxExt extends ExtDefault = ExtDefault,
  TStepExt extends ExtDefault = ExtDefault,
> = {
  startWorkflow: <TInput extends InputDefault>(
    workflow: Workflow<TInput, any, TCfgExt, TCtxExt, TStepExt>,
    input: TInput
  ) => Promise<StartData>;
};
