import type { StandardSchemaV1 } from "@standard-schema/spec";
import { z } from "zod";

// Default type for input schema
export type InputDefault = Record<string, unknown>;

// Default type for extensions (`ctx.ext` and `step.ext`)
export type ExtDefault = Record<string, unknown>;

// A schema that's static only. No runtime validation.
export function staticSchema<
  TSchema extends Record<string, unknown>,
>(): StandardSchemaV1<TSchema> {
  return z.any();
}

type InputType = "cron" | "event" | "invoke";

export type Input<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TType extends InputType = InputType,
> = {
  data: TData;
  ext: ExtDefault;
  id: string;
  name: string;
  time: Date;
  type: TType;
};

export type Context<
  TInput extends InputDefault = InputDefault,
  TExt extends ExtDefault = ExtDefault,
> = {
  ext: TExt;
  input: Input<TInput>;
  runId: string;
};

// Standard step methods
export type Step<TExt extends ExtDefault = ExtDefault> = {
  ext: TExt;
  run: <T>(stepId: string, handler: () => T) => Promise<T>;
  sleep: (stepId: string, duration: number) => Promise<void>;
  sleepUntil: (stepId: string, wakeAt: Date) => Promise<void>;
};

export type Pretty<T> = {
  [K in keyof T]: T[K];
} & {};
