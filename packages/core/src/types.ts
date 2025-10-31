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

export function isStepRunFound(step: OperationFound): step is OperationFound<{
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
  stepRunSuccess: (foundOp: OperationFound, output: unknown) => ({
    config: { code: Opcode.stepRunSuccess },
    id: foundOp.id,
    result: { status: "success", output },
  }),
  stepRunError: (foundOp: OperationFound, error: Error) => ({
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
} as const satisfies Record<string, (...args: any[]) => OperationResult>;

export type OperationResult<TOpConfig extends OpConfig = OpConfig> = {
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

export type OperationFound<TOpConfig extends OpConfig = OpConfig> = {
  config: TOpConfig;
  id: {
    hashed: string;
    id: string;
    index: number;
  };
  promise: {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  };
};
