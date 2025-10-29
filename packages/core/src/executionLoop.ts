import { Flow, type FoundStep, Opcode, type StepState } from './exeDriver';
import { type Workflow, type Steps } from './workflow';
import { createDeferredPromise } from './promises';

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
      console.log('step.run', stepId);
      const stepResolver = createDeferredPromise<T>();
      stack.push({ stepId, callback, stepResolver });
      await pause;
      return stepResolver.promise;
    },
  };

  let output: Promise<TOutput | undefined>;
  try {
    // Run the handler and pause until the next tick to discover steps
    output = workflow.handler({ step });
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      console.log('next tick', stack);
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
      // Clear the stack
      stack.length = 0;

      if (flow === Flow.continue) {
        console.log('continue');
        pauseResolve(undefined);
      }
      if (flow === Flow.interrupt) {
        console.log('interrupt');
        break;
      }
    }
  } finally {
    // cleanUp?.();
    console.log('finally');
  }
  console.log('output!');
  return output
    .then((o) => {
      console.log('executionLoop output', o);
      return o as TOutput;
    })
    .catch((e) => {
      console.error('executionLoop error', e);
      throw e;
    });
}
