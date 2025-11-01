import type { OpResult, StdContext } from "./types";

export type RunStateDriver<TContext extends StdContext = StdContext> = {
  getBaseContext(runId: string): Promise<TContext>;
  getOp(id: { runId: string; hashedOpId: string }): OpResult | undefined;
  setOp(id: { runId: string; hashedOpId: string }, op: OpResult): void;
};
