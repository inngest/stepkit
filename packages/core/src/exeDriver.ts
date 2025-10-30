import type { Workflow } from "./workflow";
import type { OperationResult, OperationFound } from "./types";
import { isStepRunFound, toResult, Opcode } from "./types";

export type ControlFlow<T = unknown> =
  | {
      type: "continue";
    }
  | {
      type: "interrupt";
      results: OperationResult[];
    };

const controlFlow = {
  continue: () => ({ type: "continue" }),
  interrupt: (results: OperationResult[]) => ({ type: "interrupt", results }),
} as const satisfies Record<string, (...args: any[]) => ControlFlow>;

export type StepState = {
  getStep(id: string): OperationResult | undefined;
  setStep(id: string, state: OperationResult): void;
};

export class BaseExeDriver {
  constructor(private state: StepState) {
    //
  }

  async onStepsFound(
    workflow: Workflow<unknown>,
    state: StepState,
    steps: OperationFound[]
  ): Promise<ControlFlow> {
    const newSteps: OperationFound[] = [];
    for (const step of steps) {
      // NOTE - Run state can't be attached to the driver - could be used in multiple workflows
      const item = state.getStep(step.id.hashed);
      if (item) {
        if (item.result.status === "success") {
          // Step already succeeded, so return its output
          step.promise.resolve(item.result.output);
        } else {
          // Step already failed, so throw its error
          step.promise.reject(item.result.error);
        }
      } else {
        // Step found for the first time
        newSteps.push(step);
      }
    }

    if (newSteps.length === 1) {
      const newStep = newSteps[0];
      if (isStepRunFound(newStep)) {
        let result: OperationResult;
        try {
          const output = await newStep.config.options.handler();
          result = toResult.stepRunSuccess(newStep, output);
          state.setStep(newStep.id.hashed, result);
          newStep.promise.resolve(output);
        } catch (e) {
          let error: Error;
          if (e instanceof Error) {
            error = e;
          } else {
            error = new Error(String(e));
          }
          result = toResult.stepRunError(newStep, error);
          state.setStep(newStep.id.hashed, result);
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
