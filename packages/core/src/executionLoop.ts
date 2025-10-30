import { type ControlFlow, type StepState } from "./exeDriver";
import { type Workflow, type Steps } from "./workflow";
import { createDeferredPromise } from "./promises";
import type { OperationFound, OperationResult } from "./types";
import { Opcode, toResult } from "./types";

export async function executionLoop<TOutput>({
  workflow,
  state,
  onStepsFound,
}: {
  workflow: Workflow<TOutput>;
  state: StepState;
  onStepsFound: (
    workflow: Workflow<TOutput>,
    state: StepState,
    steps: OperationFound[]
  ) => Promise<ControlFlow>;
}): Promise<OperationResult[]> {
  // Collect a stack of steps discovered on this tick
  const stack: any[] = [];
  let pause = createDeferredPromise<void>();

  const step: Steps = {
    run: async <T>(stepId: string, callback: () => Promise<T>) => {
      const stepResolver = createDeferredPromise<T>();

      // Report the step
      stack.push({ stepId, callback, stepResolver });

      // Pause until all steps are reported
      await pause.promise;

      return stepResolver.promise;
    },
  };

  let handlerPromise: Promise<TOutput | Error>;
  try {
    // Run the handler and pause until the next tick to discover steps
    handlerPromise = workflow.handler({ step }).catch((e) => {
      // Need to catch and return the error here instead of letting it throw. If
      // we don't we'll get "unhandled promise error" error messages during
      // testing

      if (e instanceof Error) {
        return e;
      }
      return new Error(String(e));
    });
    while (true) {
      const newPause = createDeferredPromise<void>();
      pause.promise = newPause.promise;
      pause.resolve = newPause.resolve;
      pause.reject = newPause.reject;
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (stack.length === 0) {
        // End of the function
        break;
      }

      const flow = await onStepsFound(
        workflow,
        state,
        stack.map((s) => ({
          config: {
            code: Opcode.stepRunFound,
            options: { handler: s.callback },
          },
          id: {
            hashed: s.stepId,
            id: s.stepId,
            index: 0,
          },
          promise: s.stepResolver,
        }))
      );

      if (flow.type === "continue") {
        pause.resolve(undefined);
      }
      if (flow.type === "interrupt") {
        return flow.results;
      }

      // Unreachable
    }
  } finally {
    // Clear the stack
    stack.splice(0, stack.length);
  }
  const output = await handlerPromise;
  if (output instanceof Error) {
    return [toResult.workflowError(output)];
  }

  return [toResult.workflowSuccess(output)];
}
