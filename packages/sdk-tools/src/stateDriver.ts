import type { OpResult } from "./types";

export type StateDriver = {
  getOp(id: {
    runId: string;
    hashedOpId: string;
  }): Promise<OpResult | undefined>;

  setOp(id: { runId: string; hashedOpId: string }, op: OpResult): Promise<void>;
};
