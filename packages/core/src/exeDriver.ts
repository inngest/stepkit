import type { Workflow } from "./workflow";

export const op = {
  stepRunSuccess: (output: unknown) => ({
    code: Opcode.stepRunSuccess,
    opts: { output },
  }),
  stepRunError: (error: Error) => ({
    code: Opcode.stepRunError,
    opts: { error },
  }),
  workflowSuccess: (output: unknown) => ({
    code: Opcode.workflowSuccess,
    opts: { output },
  }),
  workflowError: (error: Error) => ({
    code: Opcode.workflowError,
    opts: { error },
  }),
} as const satisfies Record<string, (...args: any[]) => Op>;

type Op = {
  code: string;
  opts: Record<string, unknown>;
};

export type Result = {
  id: {
    hashed: string;
    id: string;
    index: number;
  };
  op: Op;
};

export type ControlFlow<T = unknown> =
  | {
      type: "continue";
    }
  | {
      type: "interrupt";
      results: Result[];
    };

const controlFlow = {
  continue: () => ({ type: "continue" }),
  interrupt: (results: Result[]) => ({ type: "interrupt", results }),
} as const satisfies Record<string, (...args: any[]) => ControlFlow>;

type PromiseController = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

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

export type FoundStep<TOp extends Op = Op> = {
  id: {
    hashed: string;
    id: string;
    index: number;
  };
  op: TOp;
  promise: PromiseController;
};

export type StepStateItem =
  | { output: unknown; status: "success" }
  | { error: unknown; status: "error" };

export type StepState = {
  getStep(id: string): StepStateItem | undefined;
  setStep(id: string, state: StepStateItem): void;
};

function isStepRunFound(step: FoundStep): step is FoundStep<{
  code: typeof Opcode.stepRunFound;
  opts: { handler: () => Promise<unknown> };
}> {
  return step.op.code === Opcode.stepRunFound;
}

export class BaseExeDriver {
  constructor(private state: StepState) {
    //
  }

  async onStepsFound(
    workflow: Workflow<unknown>,
    state: StepState,
    steps: FoundStep[]
  ): Promise<ControlFlow> {
    // console.log("onStepsFound", steps);
    const newSteps: FoundStep[] = [];
    for (const step of steps) {
      // NOTE - Run state can't be attached to the driver - could be used in multiple workflows
      const item = state.getStep(step.id.hashed);
      if (item) {
        // console.log('step state found', step.id, item);
        if (item.status === "success") {
          // Step already succeeded, so return its output
          step.promise.resolve(item.output);
        } else {
          // Step already failed, so throw its error
          step.promise.reject(item.error);
        }
      } else {
        // Step found for the first time
        newSteps.push(step);
      }
    }

    if (newSteps.length === 1) {
      const newStep = newSteps[0];

      if (isStepRunFound(newStep)) {
        let result: Result;
        try {
          const output = await newStep.op.opts.handler();
          state.setStep(newStep.id.hashed, { output, status: "success" });
          newStep.promise.resolve(output);
          result = {
            id: newStep.id,
            op: op.stepRunSuccess(output),
          };
        } catch (e) {
          let error: Error;
          if (e instanceof Error) {
            error = e;
          } else {
            error = new Error(String(e));
          }
          state.setStep(newStep.id.hashed, { error, status: "error" });
          result = {
            id: newStep.id,
            op: op.stepRunError(error),
          };
        }
        return controlFlow.interrupt([result]);
      }
    } else if (newSteps.length > 1) {
      // TODO: Implement
      return controlFlow.interrupt([]);
    }

    return controlFlow.continue();
  }
}
