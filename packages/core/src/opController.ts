import { type ControlFlow } from "./types";
import { type Workflow } from "./workflow";
import { createControlledPromise } from "./promises";
import type { OpFound, OpResult } from "./types";
import type { RunStateDriver } from "./runStateDriver";
import { stdOpResult } from "./types";

/**
 * Finds ops in a controlled way, allowing the driver to make decisions when ops
 * are found. Also handles control flow.
 */
export async function runOpController<TContext, TOutput>({
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
  const foundOps: OpFound[] = [];
  let pause = createControlledPromise();

  /**
   * Reports an op and pauses it until it's allowed to continue.
   */
  async function reportOp(op: OpFound) {
    foundOps.push(op);

    // Only continue when the driver allows it
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
      if (foundOps.length === 0) {
        // End of the function
        break;
      }

      const flow = await onOpsFound(workflow, state, foundOps);
      if (flow.type === "continue") {
        // Allow ops to continue
        pause.resolve(undefined);
      }
      if (flow.type === "interrupt") {
        // Interrupt control flow and return the results
        return flow.results;
      }

      // Unreachable
    }
  } finally {
    // Clear the found ops
    foundOps.splice(0, foundOps.length);
  }

  const output = await handlerPromise;
  if (output instanceof Error) {
    return [stdOpResult.workflowError(output)];
  }

  return [stdOpResult.workflowSuccess(output)];
}
