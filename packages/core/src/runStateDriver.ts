import type { OpResult } from "./types";

export type RunStateDriver = {
  getOp(id: string): OpResult | undefined;
  setOp(id: string, op: OpResult): void;
};
