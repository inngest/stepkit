import type { StandardSchemaV1 } from "@standard-schema/spec";
import { z } from "zod";

import type { JsonError } from "./errors";
import type { ControlledPromise } from "./promises";

// Default type for input schema
export type InputSchemaDefault = StandardSchemaV1<Record<string, unknown>>;

// Default type for extensions (`ctx.ext` and `step.ext`)
export type ExtDefault = Record<string, unknown>;

export type StripStandardSchema<TInput extends InputSchemaDefault> =
  TInput extends StandardSchemaV1<infer U> ? U : never;

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
  TInput extends InputSchemaDefault = InputSchemaDefault,
  TExt extends ExtDefault = ExtDefault,
> = {
  ext: TExt;
  input: Input<StripStandardSchema<TInput>>;
  runId: string;
};

// Replace `TContext["input"]` with `TInput[]`
export type OverrideContextInput<
  TContext extends Context,
  TInput extends InputSchemaDefault,
> = Pretty<
  Omit<TContext, "input"> & {
    input: StandardSchemaV1.InferOutput<TInput>;
  }
>;

// Standard step methods
export type Step<TExt extends ExtDefault = ExtDefault> = {
  ext: TExt;
  run: <T>(stepId: string, handler: () => T) => Promise<T>;
  sleep: (stepId: string, duration: number) => Promise<void>;
};

// Standard op codes
export const StdOpCode = {
  run: "step.run",
  sleep: "step.sleep",
  workflow: "workflow",
} as const satisfies Record<keyof Omit<Step, "ext">, string> & {
  workflow: string;
};
export type StdOpCode = (typeof StdOpCode)[keyof typeof StdOpCode];

export type OpConfig = {
  code: string;
  options?: Record<string, unknown>;
};

// When an op has succeeded or errored
export type OpResult<
  TOpConfig extends OpConfig = OpConfig,
  TOutput = unknown,
> = {
  config: TOpConfig;
  id: {
    hashed: string;
    id: string;
    index: number;
  };
  result:
    | {
        status: "success";
        output: TOutput;
      }
    | {
        status: "error";
        error: JsonError;
      };
};

// When an op is found (i.e. has not succeeded or failed yet)
export type OpFound<
  TOpConfig extends OpConfig = OpConfig,
  TOutput = unknown,
> = {
  config: TOpConfig;
  handler?: () => Promise<TOutput>;
  id: {
    hashed: string;
    id: string;
    index: number;
  };
  promise: ControlledPromise<TOutput>;
};

// Whether to continue or interrupt the execution
export type ControlFlow =
  | {
      type: "continue";
    }
  | {
      type: "interrupt";
      results: OpResult[];
    };

// Create a control flow signal
export const controlFlow = {
  continue: () => ({ type: "continue" }),
  interrupt: (results: OpResult[]) => ({ type: "interrupt", results }),
} as const satisfies Record<string, (...args: any[]) => ControlFlow>;

export type Pretty<T> = {
  [K in keyof T]: T[K];
} & {};
