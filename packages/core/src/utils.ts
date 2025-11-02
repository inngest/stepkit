import { ExecutionDriver } from "./executionDriver";
import { OpResult, StdContext, StdStep } from "./types";
import { Workflow } from "./workflow";

export async function executeUntilDone<
  TContext extends StdContext,
  TStep extends StdStep,
  TOutput,
>(
  driver: ExecutionDriver<TContext, TStep>,
  workflow: Workflow<TContext, TStep, TOutput>,
  runId: string
): Promise<TOutput> {
  let i = 0;
  let maxIterations = 10_000;
  while (true) {
    i++;
    if (i > maxIterations) {
      throw new Error("unreachable: infinite loop detected");
    }

    const ops = await driver.execute(workflow, runId);
    if (ops.length !== 1) {
      // Not done yet
      continue;
    }
    const op = ops[0];
    if (op.config.code !== "workflow") {
      // Not done yet
      continue;
    }

    try {
      if (op.result.status !== "success") {
        throw op.result.error;
      }

      // @ts-expect-error
      return op.result.output;
    } catch (e) {
      throw e;
    }
  }
}
