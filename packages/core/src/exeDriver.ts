import type { Workflow } from './workflow';

export const Flow = {
  continue: 'continue',
  interrupt: 'interrupt',
} as const;
export type Flow = (typeof Flow)[keyof typeof Flow];

type PromiseController = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

export const Opcode = {
  stepRun: 'step_run',
  stepSleep: 'step_sleep',
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
  | { output: unknown; status: 'success' }
  | { error: unknown; status: 'error' };

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
  ): Promise<Flow> {
    const newSteps: FoundStep[] = [];
    for (const step of steps) {
      // NOTE - Run state can't be attached to the driver - could be used in multiple workflows
      const item = state.getStep(step.id);
      if (item) {
        console.log('step state found', step.id, item);
        if (item.status === 'success') {
          // Step already succeeded, so return its output
          step.promise.resolve(item.output);
        } else {
          // Step already failed, so throw its error
          step.promise.reject(item.error);
        }
      } else {
        // Step found for the first time
        console.log('step state not found', step.id);
        newSteps.push(step);
      }
    }

    if (newSteps.length === 1 && newSteps[0].opcode === Opcode.stepRun) {
      const newStep = newSteps[0];
      try {
        const output = await newStep.opts.handler();
        state.setStep(newStep.id, { output, status: 'success' });
      } catch (error) {
        state.setStep(newStep.id, { error, status: 'error' });
      }
    } else if (newSteps.length > 1) {
      // Todo: report
      return Flow.interrupt;
    }

    return Flow.continue;
  }
}
