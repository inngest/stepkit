import { type ControlFlow, type StepState } from "./baseExecutionDriver";
import { type Workflow, HandlerContext } from "./workflow";
import { createControlledPromise } from "./promises";
import type { OperationFound, OperationResult } from "./types";
import { toResult } from "./types";

export async function execute<TOutput>({
  workflow,
  state,
  onStepsFound,
  getContext,
}: {
  workflow: Workflow<TOutput>;
  state: StepState;
  onStepsFound: (
    workflow: Workflow<TOutput>,
    state: StepState,
    steps: OperationFound[]
  ) => Promise<ControlFlow>;
  getContext: (
    reportOp: (step: OperationFound) => Promise<void>
  ) => HandlerContext;
}): Promise<OperationResult[]> {
  // Collect a stack of steps discovered on this tick
  const stack: any[] = [];
  let pause = createControlledPromise();

  async function reportOp(step: OperationFound) {
    stack.push(step);
    await pause.promise;
  }

  const context = getContext(reportOp);

  let handlerPromise: Promise<TOutput | Error>;
  try {
    // Run the handler and pause until the next tick to discover steps
    handlerPromise = workflow.handler(context).catch((e) => {
      // Need to catch and return the error here instead of letting it throw. If
      // we don't we'll get "unhandled promise error" error messages during
      // testing

      if (e instanceof Error) {
        return e;
      }
      return new Error(String(e));
    });
    while (true) {
      const newPause = createControlledPromise();
      pause.promise = newPause.promise;
      pause.resolve = newPause.resolve;
      pause.reject = newPause.reject;
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (stack.length === 0) {
        // End of the function
        break;
      }

      const flow = await onStepsFound(workflow, state, stack);
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
