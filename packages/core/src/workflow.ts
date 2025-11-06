import type {
  Context,
  ExtDefault,
  InputSchemaDefault,
  Step,
  StripStandardSchema,
} from "./types";

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
  TInput extends InputSchemaDefault = InputSchemaDefault,
  TOutput = unknown,
  TCfgExt extends ExtDefault = ExtDefault,
  TCtxExt extends ExtDefault = ExtDefault,
  TStepExt extends ExtDefault = ExtDefault,
> {
  readonly driver: Driver<TCfgExt, TCtxExt, TStepExt>;
  readonly ext: TCfgExt | undefined;
  readonly id: string;
  readonly inputSchema: TInput | undefined;
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
    inputSchema?: TInput;
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

  async start(input: StripStandardSchema<TInput>): Promise<StartData> {
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
  startWorkflow: (
    workflow: Workflow<any, any, TCfgExt, TCtxExt, TStepExt>,
    input: StripStandardSchema<any>
  ) => Promise<StartData>;
};
