import type { ControlledPromise } from "./promises";

export const Opcode = {
  stepRunSuccess: "step.run.success",
  stepRunError: "step.run.error",
  stepRunFound: "step.run.found",
  stepRun: "step.run",
  stepSleep: "step.sleep",
  workflowSuccess: "workflow.success",
  workflowError: "workflow.error",
} as const;
export type Opcode = (typeof Opcode)[keyof typeof Opcode];

export function isStepRunFound(step: OpFound): step is OpFound<{
  code: typeof Opcode.stepRunFound;
  options: { handler: () => Promise<unknown> };
}> {
  return step.config.code === Opcode.stepRunFound;
}

type OpConfig = {
  code: string;
  options?: Record<string, unknown>;
};

export const toResult = {
  stepRunSuccess: (foundOp: OpFound, output: unknown) => ({
    config: { code: Opcode.stepRunSuccess },
    id: foundOp.id,
    result: { status: "success", output },
  }),
  stepRunError: (foundOp: OpFound, error: Error) => ({
    config: { code: Opcode.stepRunError },
    id: foundOp.id,
    result: { status: "error", error },
  }),
  workflowSuccess: (output: unknown) => ({
    config: { code: Opcode.workflowSuccess },
    id: { hashed: "", id: "", index: 0 },
    result: { status: "success", output },
  }),
  workflowError: (error: Error) => ({
    config: { code: Opcode.workflowError },
    id: { hashed: "", id: "", index: 0 },
    result: { status: "error", error },
  }),
} as const satisfies Record<string, (...args: any[]) => OpResult>;

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

export type OpFound<TOpConfig extends OpConfig = OpConfig> = {
  config: TOpConfig;
  id: {
    hashed: string;
    id: string;
    index: number;
  };
  promise: ControlledPromise<unknown>;
};

export type ControlFlow =
  | {
      type: "continue";
    }
  | {
      type: "interrupt";
      results: OpResult[];
    };

export const controlFlow = {
  continue: () => ({ type: "continue" }),
  interrupt: (results: OpResult[]) => ({ type: "interrupt", results }),
} as const satisfies Record<string, (...args: any[]) => ControlFlow>;

export type RunState = {
  getOp(id: string): OpResult | undefined;
  setOp(id: string, op: OpResult): void;
};
