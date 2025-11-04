import type { ExecutionDriver } from "./executionDriver";
import type {
  Context,
  ExtDefault,
  InputDefault,
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
  TInput extends InputDefault = InputDefault,
  TOutput = unknown,
  TCfgExt extends ExtDefault = ExtDefault,
  TCtxExt extends ExtDefault = ExtDefault,
  TStepExt extends ExtDefault = ExtDefault,
> {
  readonly driver: ExecutionDriver<TCfgExt, TCtxExt, TStepExt>;
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
    driver: ExecutionDriver<TCfgExt, TCtxExt, TStepExt>;
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

  async invoke(input: StripStandardSchema<TInput>): Promise<TOutput> {
    return this.driver.invoke(this, input);
  }
}
