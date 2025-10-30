import type { Workflow } from "./workflow";

// export const Flow = {
//   continue: "continue",
//   interrupt: "interrupt",
// } as const;
// export type Flow = (typeof Flow)[keyof typeof Flow];

// type ControlFlowContinue = {
//   type: "continue";
// };

// // When interrupting, a result must be provided
// type ControlFlowInterrupt = {
//   type: "interrupt";
//   result: unknown;
// };

type StepRunOpts =
  | {
      output: unknown;
    }
  | {
      error: Error;
    };

export const op = {
  stepRunSuccess: (output: unknown) => ({
    code: Opcode.stepRun,
    opts: { output, status: "success" },
  }),
  stepRunError: (error: Error) => ({
    code: Opcode.stepRun,
    opts: { error, status: "error" },
  }),
  stepRunPlanned: () => ({
    code: Opcode.stepRun,
    opts: { status: "planned" },
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
  hashedId: string;
  id: string;
  idIndex: number;
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

// type ControlFlow = ControlFlowContinue | ControlFlowInterrupt;

type PromiseController = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

export const Opcode = {
  stepRun: "step_run",
  stepSleep: "step_sleep",
  workflowSuccess: "workflow_success",
  workflowError: "workflow_error",
} as const;
export type Opcode = (typeof Opcode)[keyof typeof Opcode];

export type FoundStep =
  | {
      id: string;
      opcode: typeof Opcode.stepRun;
      opts: { handler: () => Promise<unknown> };
      promise: PromiseController;
    }
  | {
      id: string;
      opcode: typeof Opcode.stepSleep;
      opts: { wakeTime: Date };
      promise: PromiseController;
    };

export type StepStateItem =
  | { output: unknown; status: "success" }
  | { error: unknown; status: "error" };

export type StepState = {
  getStep(id: string): StepStateItem | undefined;
  setStep(id: string, state: StepStateItem): void;
};

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
      const item = state.getStep(step.id);
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

    if (newSteps.length === 1 && newSteps[0].opcode === Opcode.stepRun) {
      const newStep = newSteps[0];
      let result: Result;
      try {
        const output = await newStep.opts.handler();
        state.setStep(newStep.id, { output, status: "success" });
        newStep.promise.resolve(output);
        result = {
          hashedId: newStep.id,
          id: newStep.id,
          idIndex: 0,
          op: op.stepRunSuccess(output),
        };
      } catch (e) {
        let error: Error;
        if (e instanceof Error) {
          error = e;
        } else {
          error = new Error(String(e));
        }
        state.setStep(newStep.id, { error, status: "error" });
        newStep.promise.reject(error);
        result = {
          hashedId: newStep.id,
          id: newStep.id,
          idIndex: 0,
          op: op.stepRunError(error),
        };
      }
      return controlFlow.interrupt([result]);
    } else if (newSteps.length > 1) {
      // TODO: Implement
      return controlFlow.interrupt([]);
    }

    return controlFlow.continue();
  }
}
