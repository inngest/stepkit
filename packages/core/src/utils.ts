import { fromJsonError } from "./errors";
import type { OpResult } from "./types";

export async function executeUntilDone<TOutput>(
  execute: () => Promise<OpResult[]>
): Promise<TOutput> {
  const maxIterations = 10_000;
  for (let i = 0; i < maxIterations; i++) {
    const ops = await execute();
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
