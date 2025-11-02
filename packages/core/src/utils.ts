import type { ExecutionDriver } from "./executionDriver";
import type { StdContext, StdStep } from "./types";
import type { Workflow } from "./workflow";

export async function executeUntilDone<
  TContext extends StdContext,
  TStep extends StdStep,
  TOutput,
>(
  driver: ExecutionDriver<TContext, TStep>,
  workflow: Workflow<TContext, TStep, TOutput>,
  runId: string
): Promise<TOutput> {
  const maxIterations = 10_000;
  for (let i = 0; i < maxIterations; i++) {
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

    if (op.result.status !== "success") {
      throw op.result.error;
    }

    // @ts-expect-error - Necessary because of generics
    return op.result.output;
  }

  throw new Error("unreachable: infinite loop detected");
}

export function ensureAsync<T>(
  callback: (() => Promise<T>) | (() => T)
): () => Promise<T> {
  return async () => {
    return await callback();
  };
}
