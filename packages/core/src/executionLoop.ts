import { Flow, type FoundStep, Opcode, type StepState } from "./exeDriver";
import { type Workflow, type Steps } from "./workflow";
import { createDeferredPromise } from "./promises";

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
    steps: FoundStep[]
  ) => Promise<Flow>;
}) {
  // Collect a stack of steps discovered on this tick
  const stack: any[] = [];
  let pauseResolve: (value: unknown) => void = () => {}; // noop
  const pause = new Promise((resolve) => {
    pauseResolve = resolve;
  });

  const step: Steps = {
    run: async <T>(stepId: string, callback: () => Promise<T>) => {
      const stepResolver = createDeferredPromise<T>();

      // Report the step
      stack.push({ stepId, callback, stepResolver });

      // Pause until all steps are reported
      await pause;

      return stepResolver.promise;
    },
  };

  let handlerPromise: Promise<TOutput | undefined>;
  try {
    // Run the handler and pause until the next tick to discover steps
    handlerPromise = workflow.handler({ step });
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (stack.length === 0) {
        // End of the function
        break;
      }

      const flow = await onStepsFound(
        workflow,
        state,
        stack.map((s) => ({
          id: s.stepId,
          opcode: Opcode.stepRun,
          opts: { handler: s.callback },
          promise: s.stepResolver,
        }))
      );

      if (flow === Flow.continue) {
        // console.log("continue");
        for (const s of stack) {
          const output = await s.callback();
          s.stepResolver.resolve(output);
        }
        pauseResolve(undefined);
      }
      if (flow === Flow.interrupt) {
        break;
      }

      return await handlerPromise;
    }
  } finally {
    // Clear the stack
    stack.splice(0, stack.length);
  }
  const output = await handlerPromise;
  return output as TOutput;
  // return output
  //   .then((o) => {
  //     console.log('executionLoop output', o);
  //     return o as TOutput;
  //   })
  //   .catch((e) => {
  //     console.error('executionLoop error', e);
  //     throw e;
  //   });
}
