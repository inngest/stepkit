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

export type StepStateItem = { output: unknown; status: "success" } | { error: unknown; status: "error" };

export type StepState = {
  getStep(id: string): StepStateItem | undefined;
  setStep(id: string, state: StepStateItem): void;
}

export class BaseExeDriver {
  constructor(private state: StepState) {
    this.state = state;
  }

  async onStepsFound(
    workflow: Workflow,
    steps: FoundStep[]
  ): Promise<Flow> {
    const newSteps: FoundStep[] = [];
    for (const step of steps) {
      const item = this.state.getStep(step.id);
      if (item) {
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
      try {
        const output = await newStep.opts.handler();
        this.state.setStep(newStep.id, { output, status: "success" });
      } catch (error) {
        this.state.setStep(newStep.id, { error, status: "error" });
      }
    } else if (newSteps.length > 1) {
      // Todo: report
      return Flow.interrupt;
    }

    return Flow.continue;
  }
}
