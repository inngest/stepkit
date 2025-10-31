import type { OpResult } from "./types";

export type RunStateDriver = {
  getOp(id: { runId: string; hashedOpId: string }): OpResult | undefined;
  setOp(id: { runId: string; hashedOpId: string }, op: OpResult): void;
};
