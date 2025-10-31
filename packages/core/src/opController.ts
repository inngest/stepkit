import { type ControlFlow } from "./types";
import { type Workflow } from "./workflow";
import { createControlledPromise } from "./promises";
import type { OpConfig, OpFound, OpResult } from "./types";
import type { RunStateDriver } from "./runStateDriver";
import { stdOpResult } from "./types";

type LoopResult = {
  results: OpResult<OpConfig>[];
  type: "loop_result";
};

function isLoopResult(result: any): result is LoopResult {
  if (typeof result !== "object" || result === null) {
    return false;
  }
  return "type" in result && result.type === "loop_result";
}

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
  async function reportOp(op: OpFound): Promise<any> {
    foundOps.push(op);

    // Only continue when the driver allows it
    await pause.promise;

    const output = await op.promise.promise;
    return output;
  }

  const context = getContext(reportOp);

  let handlerPromise: Promise<TOutput | Error>;

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

  async function opLoop(): Promise<LoopResult> {
    let i = 0;

    // Arbitrarily limit the number of iterations to prevent infinite loops
    let maxIterations = 10_000;

    while (true) {
      i++;
      if (i > maxIterations) {
        throw new Error("unreachable: infinite loop detected");
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
      if (foundOps.length === 0) {
        pause.reset();
        continue;
      }

      const flow = await onOpsFound(workflow, state, foundOps);
      if (flow.type === "continue") {
        foundOps.splice(0, foundOps.length);
        // Allow ops to continue
        pause = pause.resolve(undefined);
        continue;
      }
      if (flow.type === "interrupt") {
        // Interrupt control flow and return the results
        return {
          type: "loop_result",
          results: flow.results,
        };
      }

      throw new Error("unreachable");
    }
  }

  const output = await Promise.race([opLoop(), handlerPromise]);
  if (isLoopResult(output)) {
    return output.results;
  }

  if (output instanceof Error) {
    return [stdOpResult.workflowError(output)];
  }

  return [stdOpResult.workflowSuccess(output)];
}
