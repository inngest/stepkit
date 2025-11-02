import type { JsonError } from "./errors";
import type { ControlledPromise } from "./promises";

export type StdContext = {
  runId: string;
};

// Standard step methods
export type StdStep = {
  run: <T>(stepId: string, handler: () => T) => Promise<T>;
  sleep: (stepId: string, duration: number) => Promise<void>;
};

// Standard op codes
export const StdOpCode = {
  run: "step.run",
  sleep: "step.sleep",
  workflow: "workflow",
} as const satisfies Record<keyof StdStep, string> & { workflow: string };
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
