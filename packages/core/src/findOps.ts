import { createControlledPromise } from "./promises";
import {
  StdOpCode,
  type ControlFlow,
  type OpFound,
  type OpResult,
  type StdContext,
  type StdStep as StdSteps,
} from "./types";
import { type Workflow } from "./workflow";

export type ReportOp = <TOutput = void>(
  op: OpFound<any, TOutput>
) => Promise<TOutput>;

/**
 * Finds ops in a controlled way, allowing the driver to make decisions when ops
 * are found. Also handles control flow.
 */
export async function findOps<
  TContext extends StdContext,
  TSteps extends StdSteps,
  TOutput,
>({
  workflow,
  ctx,
  onOpsFound,
  getSteps,
}: {
  workflow: Workflow<TContext, TSteps, TOutput>;
  ctx: TContext;
  onOpsFound: (ops: OpFound[]) => Promise<ControlFlow>;
  getSteps: (reportOp: ReportOp) => Promise<TSteps>;
}): Promise<OpResult[]> {
  const foundOps: OpFound[] = [];

  let pause = createControlledPromise();

  /**
   * Reports an op and pauses it until it's allowed to continue.
   */
  async function reportOp(op: OpFound<any, any>): Promise<any> {
    foundOps.push(op);

    // Only continue when the driver allows it
    await pause.promise;

    return await op.promise.promise;
  }

  const step = await getSteps(reportOp);

  // Run the handler and pause until the next tick to discover ops
  const handlerPromise = workflow.handler(ctx, step).catch((e: unknown) => {
    // Need to catch and return the error here instead of letting it throw. If
    // we don't we'll get "unhandled promise error" error messages during
    // testing

    if (e instanceof Error) {
      return e;
    }
    return new Error(String(e));
  });

  async function opLoop() {
    // Arbitrarily limit the number of iterations to prevent infinite loops
    const maxIterations = 10_000;

    for (let i = 0; i < maxIterations; i++) {
      try {
        i++;
        if (i > maxIterations) {
          throw new Error("unreachable: infinite loop detected");
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
        if (foundOps.length === 0) {
          pause.reset();
          return [];
        }

        const flow = await onOpsFound(foundOps);
        if (flow.type === "continue") {
          // Allow ops to continue
          pause = pause.resolve(undefined);
          continue;
        }
        // Interrupt control flow and return the results
        return flow.results;
      } finally {
        foundOps.splice(0, foundOps.length);
      }
    }

    throw new Error("unreachable: infinite loop detected");
  }

  const ops = await opLoop();
  if (ops.length > 0) {
    return ops;
  }

  const output = await handlerPromise;
  if (output instanceof Error) {
    return [
      {
        config: { code: StdOpCode.workflow },
        id: { hashed: "", id: "", index: 0 },
        result: { status: "error", error: output },
      },
    ];
  }
  return [
    {
      config: { code: StdOpCode.workflow },
      id: { hashed: "", id: "", index: 0 },
      result: { status: "success", output },
    },
  ];
}
