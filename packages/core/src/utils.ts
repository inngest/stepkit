import { fromJsonError } from "./errors";
import type { OpResult, StdContext, StdStep } from "./types";
import type { Workflow } from "./workflow";

export async function executeUntilDone<
  TContext extends StdContext,
  TStep extends StdStep,
  TOutput,
>(
  execute: (
    ctx: TContext,
    workflow: Workflow<TContext, TStep, TOutput>
  ) => Promise<OpResult[]>,
  workflow: Workflow<TContext, TStep, TOutput>,
  ctx: TContext
): Promise<TOutput> {
  const maxIterations = 10_000;
  for (let i = 0; i < maxIterations; i++) {
    const ops = await execute(ctx, workflow);
    const op = ops[0];

    if (op.result.status === "error") {
      if (op.result.canRetry) {
        // Bump attempt and retry
        ctx.attempt++;
        continue;
      }

      if (op.config.code !== "workflow") {
        // Reset attempt because we've exhausted step retries and now need fresh
        // attempts at the workflow level
        ctx.attempt = 0;
      }
    }

    if (op.config.code !== "workflow") {
      // Not done yet
      continue;
    }

    if (op.result.status !== "success") {
      throw fromJsonError(op.result.error);
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
