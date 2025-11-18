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

export type WaitingInvoke = {
  op: OpResults["invokeWorkflow"];
  childRun: {
    runId: string;
    workflowId: string;
  };
  parentRun: {
    runId: string;
    workflowId: string;
  };
};

export type WaitingSignal = {
  op: OpResults["waitForSignal"];
  runId: string;
  workflowId: string;
};

export type InvokeManager = {
  add(invoke: WaitingInvoke): Promise<void>;

  popByChildRun(runId: string): Promise<WaitingInvoke | null>;

  popByParentOp({
    hashedOpId,
    runId,
  }: {
    hashedOpId: string;
    runId: string;
  }): Promise<WaitingInvoke | null>;
};

export type SignalManager = {
  add(signal: WaitingSignal): Promise<void>;
  pop(signal: string): Promise<WaitingSignal | null>;
};

export interface LocalStateDriver extends StateDriver {
  waitingInvokes: InvokeManager;
  waitingSignals: SignalManager;

  setOp(
    { hashedOpId, runId }: { hashedOpId: string; runId: string },
    op: OpResult,
    opts?: { force?: boolean }
  ): Promise<void>;

  addRun(run: Run): Promise<void>;
  getRun(runId: string): Promise<Run | undefined>;
  endRun(runId: string, op: OpResult): Promise<void>;

  incrementOpAttempt(runId: string, hashedOpId: string): Promise<number>;

  getMaxAttempts(runId: string): Promise<number>;
}
