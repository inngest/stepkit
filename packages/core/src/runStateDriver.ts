import type { BaseContext, OpResult, StdContext } from "./types";

export type RunStateDriver<TContext extends StdContext = StdContext> = {
  getBaseContext(runId: string): Promise<Omit<TContext, "step">>;
  getOp(id: { runId: string; hashedOpId: string }): OpResult | undefined;
  setOp(id: { runId: string; hashedOpId: string }, op: OpResult): void;
};
