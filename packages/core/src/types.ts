import type { ControlledPromise } from "./promises";
import z from "zod";

// Standard opcodes
export const StdOpcode = {
  stepRunError: "step.run.error",
  stepRunFound: "step.run.found",
  stepRunSuccess: "step.run.success",
  stepSleep: "step.sleep",
  workflowSuccess: "workflow.success",
  workflowError: "workflow.error",
} as const;
export type StdOpcode = (typeof StdOpcode)[keyof typeof StdOpcode];

export type OpConfig = {
  code: string;
  options?: Record<string, unknown>;
};

// Schema for standard op configs
export const stdOpConfigSchemas = {
  [StdOpcode.stepRunFound]: z.object({
    code: z.literal(StdOpcode.stepRunFound),
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
  [StdOpcode.workflowSuccess]: z.object({
    code: z.literal(StdOpcode.workflowSuccess),
    result: z.object({
      output: z.any(),
    }),
  }),
  [StdOpcode.workflowError]: z.object({
    code: z.literal(StdOpcode.workflowError),
    result: z.object({
      error: z.instanceof(Error),
    }),
  }),
} as const;

// Create a standard op result
export const stdOpResult = {
  stepRunSuccess: (foundOp: OpFound, output: unknown) => ({
    config: { code: StdOpcode.stepRunSuccess },
    id: foundOp.id,
    result: { status: "success", output },
  }),
  stepRunError: (foundOp: OpFound, error: Error) => ({
    config: { code: StdOpcode.stepRunError },
    id: foundOp.id,
    result: { status: "error", error },
  }),
  stepSleep: (foundOp: OpFound) => ({
    config: { code: StdOpcode.stepSleep },
    id: foundOp.id,
    result: { status: "success", output: undefined },
  }),
  workflowSuccess: (output: unknown) => ({
    config: { code: StdOpcode.workflowSuccess },
    id: { hashed: "", id: "", index: 0 },
    result: { status: "success", output },
  }),
  workflowError: (error: Error) => ({
    config: { code: StdOpcode.workflowError },
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

export type RunStateDriver = {
  getOp(id: string): OpResult | undefined;
  setOp(id: string, op: OpResult): void;
};

export type StdContext = {
  step: {
    run: <T>(stepId: string, handler: () => Promise<T>) => Promise<T>;
    sleep: (stepId: string, duration: number) => Promise<void>;
  };
};
