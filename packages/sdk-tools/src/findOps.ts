import { type Workflow } from "@stepkit/core";
import {
  type Context,
  type ExtDefault,
  type InputDefault,
  type Step,
} from "@stepkit/core/implementer";

import { toJsonError } from "./errors";
import { createControlledPromise } from "./promises";
import {
  StdOpCode,
  type ControlFlow,
  type OpConfig,
  type OpFound,
  type OpResult,
} from "./types";
import { type HashId } from "./utils";

export type ReportOp = <TOutput = void>(
  op: OpFound<OpConfig, TOutput>
) => Promise<TOutput>;

/**
 * Finds ops in a controlled way, allowing the driver to make decisions when ops
 * are found. Also handles control flow.
 */
export async function findOps<
  TInput extends InputDefault,
  TOutput,
  TWorkflowCfgExt extends ExtDefault,
  TCtxExt extends ExtDefault,
  TStepExt extends ExtDefault,
>({
  ctx,
  getStep,
  hashId,
  onStepsFound,
  onWorkflowResult,
  workflow,
}: {
  ctx: Context<TInput, TCtxExt>;
  getStep: (reportOp: ReportOp) => Promise<Step<TStepExt>>;
  hashId: HashId;
  onStepsFound: (ops: OpFound[]) => Promise<ControlFlow>;
  onWorkflowResult: (op: OpResult) => Promise<OpResult>;
  workflow: Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt>;
}): Promise<OpResult[]> {
  const foundOps: OpFound<OpConfig, any>[] = [];

  // Count the number of times an op ID is found. This is necessary for
  // generating a unique hash each time a duplicate op is found
  const idCounter: Record<string, number> = {};

  let pause = createControlledPromise();

  /**
   * Reports an op and pauses it until it's allowed to continue.
   */
  async function reportOp<TOutput>(
    op: OpFound<OpConfig, TOutput>
  ): Promise<TOutput> {
    const index = (idCounter[op.id.id] ?? -1) + 1;
    idCounter[op.id.id] = index;

    foundOps.push({
      ...op,
      id: {
        ...op.id,
        hashed: hashId(op.id.id, index),
        index,
      },
    });

    // Only continue when the driver allows it
    await pause.promise;

    return await op.promise.promise;
  }

  const step = await getStep(reportOp);

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

        const flow = await onStepsFound(foundOps);
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

  let opResult: OpResult;
  const output = await handlerPromise;
  if (output instanceof Error) {
    opResult = {
      config: { code: StdOpCode.workflow },
      id: { hashed: "", id: "", index: 0 },
      result: {
        status: "error",
        error: toJsonError(output),
      },
    };
  } else {
    opResult = {
      config: { code: StdOpCode.workflow },
      id: { hashed: "", id: "", index: 0 },
      result: {
        status: "success",
        output,
      },
    };
  }

  return [await onWorkflowResult(opResult)];
}
