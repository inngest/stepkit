import type { Context, OpResult, StateDriver } from "@stepkit/sdk-tools";

export type Run = {
  ctx: Context<any, any>;
  maxAttempts: number;
  opAttempts: Record<string, number>;
  result: OpResult["result"] | undefined;
  workflowId: string;
};

export interface LocalStateDriver extends StateDriver {
  addRun(run: Run): Promise<void>;
  getRun(runId: string): Promise<Run | undefined>;
  endRun(runId: string, op: OpResult): Promise<void>;

  incrementOpAttempt(runId: string, hashedOpId: string): Promise<number>;

  getMaxAttempts(runId: string): Promise<number>;

  wakeSleepOp(
    id: { runId: string; hashedOpId: string },
    op: OpResult
  ): Promise<void>;
}
