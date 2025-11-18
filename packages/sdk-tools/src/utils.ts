import hash from "hash.js";

import { type Workflow } from "@stepkit/core";
import type {
  Context,
  ExtDefault,
  InputDefault,
} from "@stepkit/core/implementer";

import { fromJsonError } from "./errors";
import { isOpResult } from "./ops";
import type { OpResult } from "./types";

const defaultMaxAttempts = 4;

export async function executeUntilDone<
  TInput extends InputDefault,
  TOutput,
  TWorkflowCfgExt extends ExtDefault,
  TCtxExt extends ExtDefault,
  TStepExt extends ExtDefault,
>(
  execute: (
    ctx: Context<TInput, TCtxExt>,
    workflow: Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt>
  ) => Promise<OpResult[]>,
  workflow: Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt>,
  ctx: Context<TInput, TCtxExt>
): Promise<TOutput> {
  const attempts: Record<string, number> = {};
  const maxIterations = 10_000;
  for (let i = 0; i < maxIterations; i++) {
    const ops = await execute(ctx, workflow);
    if (ops[0] === undefined) {
      throw new Error("unreachable: no ops found");
    }
    const op = ops[0];
    const attempt = attempts[op.opId.hashed] ?? 1;

    if (op.result.status === "error") {
      if (op.result.error.props?.canRetry === false) {
        throw fromJsonError(op.result.error);
      }

      if (attempt < (workflow.maxAttempts ?? defaultMaxAttempts)) {
        // Bump attempt and retry
        attempts[op.opId.hashed] = attempt + 1;
        continue;
      }
    }

    if (isOpResult.sleep(op)) {
      // TODO: This probably doesn't work with parallel steps
      await sleepUntil(new Date(op.config.options.wakeAt));
      continue;
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

async function sleepUntil(wakeAt: Date): Promise<void> {
  const now = new Date();
  if (wakeAt < now) {
    return;
  }
  await new Promise((resolve) =>
    setTimeout(resolve, wakeAt.getTime() - now.getTime())
  );
}
