import type { Workflow } from "./workflow";

const Flow = {
  continue: "continue",
  interrupt: "interrupt",
} as const;
type Flow = (typeof Flow)[keyof typeof Flow];

type PromiseController = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

const Opcode = {
  stepRun: "step_run",
  stepSleep: "step_sleep",
} as const;
type Opcode = (typeof Opcode)[keyof typeof Opcode];

type FoundStep =
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

type StepState = Record<
  string,
  { output: unknown; status: "success" } | { error: unknown; status: "error" }
>;

export class BaseExeDriver {
  async onStepsFound(
    workflow: Workflow,
    stepState: StepState,
    steps: FoundStep[]
  ): Promise<Flow> {
    const newSteps: FoundStep[] = [];
    for (const step of steps) {
      if (step.id in stepState) {
        const state = stepState[step.id];
        if (state.status === "success") {
          // Step already succeeded, so return its output
          step.promise.resolve(state.output);
        } else {
          // Step already failed, so throw its error
          step.promise.reject(state.error);
        }
      } else {
        // Step found for the first time
        newSteps.push(step);
      }
    }

    if (newSteps.length === 1 && newSteps[0].opcode === Opcode.stepRun) {
      const newStep = newSteps[0];
      try {
        const output = await newStep.opts.handler();
        stepState[newStep.id] = { output, status: "success" };
      } catch (error) {
        stepState[newStep.id] = { error, status: "error" };
      }
    } else if (newSteps.length > 1) {
      // Todo: report
      return Flow.interrupt;
    }

    return Flow.continue;
  }
}
