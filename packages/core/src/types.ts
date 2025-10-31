import type { ControlledPromise } from "./promises";
import z from "zod";

// Standard opcodes
export const StdOpcode = {
  stepRun: "step.run",
  stepSleep: "step.sleep",
  workflow: "workflow",
} as const;
export type StdOpcode = (typeof StdOpcode)[keyof typeof StdOpcode];

export type OpConfig = {
  code: string;
  options?: Record<string, unknown>;
};

// Schema for standard op configs
export const stdOpConfigSchemas = {
  [StdOpcode.stepRun]: z.object({
    code: z.literal(StdOpcode.stepRun),
    options: z.object({
      handler: z.function({
        output: z.promise(z.any()),
      }),
    }),
  }),
  [StdOpcode.stepSleep]: z.object({
    code: z.literal(StdOpcode.stepSleep),
    options: z.object({
      wakeupAt: z.date(),
    }),
  }),
  [StdOpcode.workflow]: z.object({
    code: z.literal(StdOpcode.workflow),
  }),
} as const;

// Create a standard op result
export const stdOpResult = {
  stepRunSuccess: (foundOp: OpFound, output: unknown) => ({
    config: { code: StdOpcode.stepRun },
    id: foundOp.id,
    result: { status: "success", output },
  }),
  stepRunError: (foundOp: OpFound, error: Error) => ({
    config: { code: StdOpcode.stepRun },
    id: foundOp.id,
    result: { status: "error", error },
  }),
  stepSleep: (foundOp: OpFound) => ({
    config: { code: StdOpcode.stepSleep },
    id: foundOp.id,
    result: { status: "success", output: undefined },
  }),
  workflowSuccess: (output: unknown) => ({
    config: { code: StdOpcode.workflow },
    id: { hashed: "", id: "", index: 0 },
    result: { status: "success", output },
  }),
  workflowError: (error: Error) => ({
    config: { code: StdOpcode.workflow },
    id: { hashed: "", id: "", index: 0 },
    result: { status: "error", error },
  }),
} as const satisfies Record<string, (...args: any[]) => OpResult>;

// When an op has succeeded or failed
export type OpResult<TOpConfig extends OpConfig = OpConfig> = {
  config: TOpConfig;
  id: {
    hashed: string;
    id: string;
    index: number;
  };
  result:
    | {
        status: "success";
        output: unknown;
      }
    | {
        status: "error";
        error: Error;
      };
};

// When an op is found (i.e. has not succeeded or failed yet)
export type OpFound<TOpConfig extends OpConfig = OpConfig> = {
  config: TOpConfig;
  id: {
    hashed: string;
    id: string;
    index: number;
  };
  promise: ControlledPromise<unknown>;
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

export type StdContext = {
  step: {
    run: <T>(stepId: string, handler: () => Promise<T>) => Promise<T>;
    sleep: (stepId: string, duration: number) => Promise<void>;
  };
};
