import type {
  Context,
  OpResult,
  OpResults,
  StateDriver,
} from "@stepkit/sdk-tools";

export type Run = {
  ctx: Context<any, any>;
  maxAttempts: number;
  opAttempts: Record<string, number>;
  result: OpResult["result"] | undefined;
  workflowId: string;
};

export type WaitingSignal = {
  op: OpResults["waitForSignal"];
  runId: string;
  workflowId: string;
};

export type ResumeWaitForSignalOpOpts = {
  data: unknown;
  waitingSignal: WaitingSignal;
};

export interface LocalStateDriver extends StateDriver {
  addRun(run: Run): Promise<void>;
  getRun(runId: string): Promise<Run | undefined>;
  endRun(runId: string, op: OpResult): Promise<void>;

  addWaitingSignal(signal: WaitingSignal): Promise<void>;
  popWaitingSignal(signal: string): Promise<WaitingSignal | null>;
  resumeWaitForSignalOp(opts: ResumeWaitForSignalOpOpts): Promise<void>;
  timeoutWaitForSignalOp(signal: string): Promise<void>;

  incrementOpAttempt(runId: string, hashedOpId: string): Promise<number>;

  getMaxAttempts(runId: string): Promise<number>;

  wakeSleepOp(
    id: { runId: string; hashedOpId: string },
    op: OpResult
  ): Promise<void>;
}
