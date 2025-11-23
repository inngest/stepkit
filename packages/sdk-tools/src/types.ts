import type { Step } from "@stepkit/core/implementer";

import type { JsonError } from "./errors";
import type { ControlledPromise } from "./promises";

// Standard op codes
export const StdOpCode = {
  invokeWorkflow: "step.invokeWorkflow",
  run: "step.run",
  sendSignal: "step.sendSignal",
  sleep: "step.sleep",
  sleepUntil: "step.sleepUntil",
  waitForSignal: "step.waitForSignal",
  workflow: "workflow",
} as const satisfies Record<keyof Omit<Step, "ext">, string> & {
  workflow: string;
};
export type StdOpCode = (typeof StdOpCode)[keyof typeof StdOpCode];

export type OpConfig = {
  code: string;
  options?: Record<string, unknown>;
  mode: "immediate" | "scheduled";
};

// When an op has succeeded or errored
export type OpResult<
  TOpConfig extends OpConfig = OpConfig,
  TOutput = unknown,
> = {
  config: TOpConfig;
  opId: {
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
      }
    | {
        status: "plan";
      };
  runId: string;
  workflowId: string;
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
