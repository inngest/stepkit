import {
  disableRetries,
  InvokeTimeoutError,
  StdOpCode,
  toJsonError,
  type Context,
  type OpResult,
  type OpResults,
} from "@stepkit/sdk-tools";

import type {
  InvokeManager,
  LocalStateDriver,
  ResumeInvokeWorkflowOpOpts,
  ResumeWaitForSignalOpOpts,
  WaitingInvoke,
  WaitingSignal,
} from "../common/stateDriver";
import { UnreachableError } from "./utils/errors";
import { deleteFile, readJsonFile, writeJsonFile } from "./utils/fs";
import { FileSystemPaths } from "./utils/paths";

export type Run = {
  ctx: Context<any, any>;
  maxAttempts: number;
  opAttempts: Record<string, number>;
  result: OpResult["result"] | undefined;
  workflowId: string;
};

class FileSystemInvokeManager implements InvokeManager {
  constructor(private paths: FileSystemPaths) {}

  async add(invoke: WaitingInvoke): Promise<void> {
    const byChildPath = this.paths.invokeByChildRunFile(invoke.childRun.runId);
    const byParentPath = this.paths.invokeByParentOpFile(
      invoke.parentRun.runId,
      invoke.op.id.hashed
    );

    const existingByParent = await readJsonFile<WaitingInvoke>(byParentPath);
    if (existingByParent !== undefined) {
      throw new Error("waiting invoke already exists");
    }

    await writeJsonFile(byChildPath, invoke);
    await writeJsonFile(byParentPath, invoke);
  }

  async popByChildRun(runId: string): Promise<WaitingInvoke | null> {
    const byChildPath = this.paths.invokeByChildRunFile(runId);
    const waitingInvoke = await readJsonFile<WaitingInvoke>(byChildPath);
    if (waitingInvoke === undefined) {
      return null;
    }

    await deleteFile(byChildPath);
    await deleteFile(
      this.paths.invokeByParentOpFile(
        waitingInvoke.parentRun.runId,
        waitingInvoke.op.id.hashed
      )
    );

    return waitingInvoke;
  }

  async popByParentOp({
    hashedOpId,
    runId,
  }: {
    hashedOpId: string;
    runId: string;
  }): Promise<WaitingInvoke | null> {
    const byParentPath = this.paths.invokeByParentOpFile(runId, hashedOpId);
    const waitingInvoke = await readJsonFile<WaitingInvoke>(byParentPath);
    if (waitingInvoke === undefined) {
      return null;
    }

    await deleteFile(byParentPath);
    await deleteFile(
      this.paths.invokeByChildRunFile(waitingInvoke.childRun.runId)
    );

    return waitingInvoke;
  }
}

export class FileSystemStateDriver implements LocalStateDriver {
  private paths: FileSystemPaths;
  waitingInvokes: FileSystemInvokeManager;

  constructor(baseDir: string) {
    this.paths = new FileSystemPaths(baseDir);
    this.waitingInvokes = new FileSystemInvokeManager(this.paths);
  }

  async addRun(run: Run): Promise<void> {
    const filePath = this.paths.runFile(run.ctx.runId);
    await writeJsonFile(filePath, run);
  }

  async getRun(runId: string): Promise<Run | undefined> {
    const filePath = this.paths.runFile(runId);
    return await readJsonFile<Run>(filePath);
  }

  async endRun(runId: string, op: OpResult): Promise<void> {
    const run = await this.getRun(runId);
    if (run === undefined) {
      throw new UnreachableError("run not found");
    }
    run.result = op.result;
    await this.addRun(run);
  }

  async resumeInvokeWorkflowOp({
    childRunId,
    op,
  }: ResumeInvokeWorkflowOpOpts): Promise<WaitingInvoke | null> {
    const waitingInvoke = await this.waitingInvokes.popByChildRun(childRunId);
    if (waitingInvoke === null) {
      return null;
    }

    if (op.result.status === "error") {
      op.result.error = disableRetries(op.result.error);
    }

    const opResult: OpResults["invokeWorkflow"] = {
      config: waitingInvoke.op.config,
      id: waitingInvoke.op.id,
      result: op.result,
    };
    const filePath = this.paths.opFile(
      waitingInvoke.parentRun.runId,
      waitingInvoke.op.id.hashed
    );
    await writeJsonFile(filePath, opResult);
    return waitingInvoke;
  }

  async timeoutInvokeWorkflowOp({
    hashedOpId,
    runId,
  }: {
    hashedOpId: string;
    runId: string;
  }): Promise<void> {
    const waitingInvoke = await this.waitingInvokes.popByParentOp({
      hashedOpId,
      runId,
    });
    if (waitingInvoke === null) {
      return;
    }

    const error = new InvokeTimeoutError({
      childRunId: waitingInvoke.childRun.runId,
    });

    const opResult: OpResults["invokeWorkflow"] = {
      config: waitingInvoke.op.config,
      id: waitingInvoke.op.id,
      result: {
        status: "error",
        error: toJsonError(error),
      },
    };
    const filePath = this.paths.opFile(
      waitingInvoke.parentRun.runId,
      waitingInvoke.op.id.hashed
    );
    await writeJsonFile(filePath, opResult);
  }

  async addWaitingSignal(signal: WaitingSignal): Promise<void> {
    const filePath = this.paths.signalFile(signal.op.config.options.signal);
    const existingSignal = await readJsonFile<WaitingSignal>(filePath);
    if (existingSignal !== undefined) {
      throw new Error("waiting signal already exists");
    }
    await writeJsonFile(filePath, signal);
  }

  async popWaitingSignal(signal: string): Promise<WaitingSignal | null> {
    const filePath = this.paths.signalFile(signal);
    const waitingSignal = await readJsonFile<WaitingSignal>(filePath);
    if (waitingSignal === undefined) {
      return null;
    }
    await deleteFile(filePath);
    return waitingSignal;
  }

  async resumeWaitForSignalOp({
    data,
    waitingSignal,
  }: ResumeWaitForSignalOpOpts): Promise<void> {
    const opResult: OpResults["waitForSignal"] = {
      config: {
        code: StdOpCode.waitForSignal,
        options: waitingSignal.op.config.options,
      },
      id: waitingSignal.op.id,
      result: {
        status: "success",
        output: {
          data,
          signal: waitingSignal.op.config.options.signal,
        },
      },
    };
    await writeJsonFile(
      this.paths.opFile(waitingSignal.runId, waitingSignal.op.id.hashed),
      opResult
    );
  }

  async timeoutWaitForSignalOp(signal: string): Promise<void> {
    const waitingSignal = await this.popWaitingSignal(signal);
    if (waitingSignal === null) {
      return;
    }
    const opResult: OpResults["waitForSignal"] = {
      config: {
        code: StdOpCode.waitForSignal,
        options: waitingSignal.op.config.options,
      },
      id: waitingSignal.op.id,
      result: {
        status: "success",
        output: null,
      },
    };
    await writeJsonFile(
      this.paths.opFile(waitingSignal.runId, waitingSignal.op.id.hashed),
      opResult
    );
  }

  async incrementOpAttempt(runId: string, hashedOpId: string): Promise<number> {
    const run = await this.getRun(runId);
    if (run === undefined) {
      throw new UnreachableError("run not found");
    }
    run.opAttempts[hashedOpId] = (run.opAttempts[hashedOpId] ?? 0) + 1;
    await this.addRun(run);
    return run.opAttempts[hashedOpId];
  }

  async getMaxAttempts(runId: string): Promise<number> {
    const run = await this.getRun(runId);
    if (run === undefined) {
      throw new UnreachableError("run not found");
    }
    return run.maxAttempts;
  }

  async getOp({
    runId,
    hashedOpId,
  }: {
    runId: string;
    hashedOpId: string;
  }): Promise<OpResult | undefined> {
    const filePath = this.paths.opFile(runId, hashedOpId);
    return await readJsonFile<OpResult>(filePath);
  }

  async setOp(
    { runId, hashedOpId }: { runId: string; hashedOpId: string },
    op: OpResult
  ): Promise<void> {
    if (
      op.config.code === StdOpCode.invokeWorkflow ||
      op.config.code === StdOpCode.sleep ||
      op.config.code === StdOpCode.waitForSignal
    ) {
      return;
    }

    // Note: Using sync operations for incrementOpAttempt and getMaxAttempts
    const run = await this.getRun(runId);
    if (run === undefined) {
      // Log instead of error since parallel steps can hit this line
      console.error("unreachable: run not found");
      return;
    }

    run.opAttempts[hashedOpId] = (run.opAttempts[hashedOpId] ?? 0) + 1;
    const opAttempt = run.opAttempts[hashedOpId];
    await this.addRun(run);

    if (op.result.status === "error" && opAttempt < run.maxAttempts) {
      // Retry by not storing the error
      return;
    }

    const filePath = this.paths.opFile(runId, hashedOpId);
    await writeJsonFile(filePath, op);
  }

  async wakeSleepOp(
    { runId, hashedOpId }: { runId: string; hashedOpId: string },
    op: OpResult
  ): Promise<void> {
    if (op.config.code !== StdOpCode.sleep) {
      throw new UnreachableError("op is not a sleep");
    }

    const filePath = this.paths.opFile(runId, hashedOpId);
    await writeJsonFile(filePath, op);
  }
}
