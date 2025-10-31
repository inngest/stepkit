import { type ControlFlow } from "./types";
import { type Workflow } from "./workflow";
import { createControlledPromise } from "./promises";
import type { OpFound, OpResult, RunStateDriver } from "./types";
import { stdOpResult } from "./types";

export async function execute<TContext, TOutput>({
  workflow,
  state,
  onOpsFound,
  getContext,
}: {
  workflow: Workflow<any, TOutput>;
  state: RunStateDriver;
  onOpsFound: (
    workflow: Workflow<any, TOutput>,
    state: RunStateDriver,
    ops: OpFound[]
  ) => Promise<ControlFlow>;
  getContext: (reportOp: (op: OpFound) => Promise<void>) => TContext;
}): Promise<OpResult[]> {
  // Collect a stack of ops discovered on this tick
  const stack: any[] = [];
  let pause = createControlledPromise();

  async function reportOp(op: OpFound) {
    stack.push(op);
    await Promise.all([pause.promise, op.promise.promise]);
  }

  const context = getContext(reportOp);

  let handlerPromise: Promise<TOutput | Error>;
  try {
    // Run the handler and pause until the next tick to discover ops
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

      const flow = await onOpsFound(workflow, state, stack);
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
    return [stdOpResult.workflowError(output)];
  }

  return [stdOpResult.workflowSuccess(output)];
}
