import hash from "hash.js";

import { fromJsonError } from "./errors";
import type { InputDefault, OpResult, StdContext, StdStep } from "./types";
import type { Workflow } from "./workflow";

export async function executeUntilDone<
  TInput extends InputDefault,
  TOutput,
  TContext extends StdContext<TInput>,
  TStep extends StdStep,
>(
  execute: (
    ctx: TContext,
    workflow: Workflow<TInput, TOutput, TContext, TStep>
  ) => Promise<OpResult[]>,
  workflow: Workflow<TInput, TOutput, TContext, TStep>,
  ctx: TContext
): Promise<TOutput> {
  const attempts: Record<string, number> = {};
  const maxIterations = 10_000;
  for (let i = 0; i < maxIterations; i++) {
    const ops = await execute(ctx, workflow);
    const op = ops[0];
    attempts[op.id.hashed] = attempts[op.id.hashed] ?? 1;

    if (op.result.status === "error") {
      if (attempts[op.id.hashed] < workflow.maxAttempts) {
        // Bump attempt and retry
        attempts[op.id.hashed]++;
        continue;
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

export type HashId = (id: string, index: number) => string;

// Standard hash function for op IDs
export function stdHashId(id: string, index: number): string {
  return hash.sha1().update(`${id}:${index.toString()}`).digest("hex");
}
