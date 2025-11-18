import { StdOpCode, type Context, type OpResult } from "@stepkit/sdk-tools";

import { UnreachableError } from "../common/errors";
import type {
  InvokeManager,
  LocalStateDriver,
  SignalManager,
  WaitingInvoke,
  WaitingSignal,
} from "../common/stateDriver";
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

class FileSystemSignalManager implements SignalManager {
  constructor(private paths: FileSystemPaths) {}

  async add(signal: WaitingSignal): Promise<void> {
    const filePath = this.paths.signalFile(signal.op.config.options.signal);
    const existingSignal = await readJsonFile<WaitingSignal>(filePath);
    if (existingSignal !== undefined) {
      throw new Error("waiting signal already exists");
    }
    await writeJsonFile(filePath, signal);
  }

  async pop(signal: string): Promise<WaitingSignal | null> {
    const filePath = this.paths.signalFile(signal);
    const waitingSignal = await readJsonFile<WaitingSignal>(filePath);
    if (waitingSignal === undefined) {
      return null;
    }
    await deleteFile(filePath);
    return waitingSignal;
  }
}

export class FileSystemStateDriver implements LocalStateDriver {
  private paths: FileSystemPaths;
  waitingInvokes: FileSystemInvokeManager;
  waitingSignals: FileSystemSignalManager;

  constructor(baseDir: string) {
    this.paths = new FileSystemPaths(baseDir);
    this.waitingInvokes = new FileSystemInvokeManager(this.paths);
    this.waitingSignals = new FileSystemSignalManager(this.paths);
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
    op: OpResult,
    { force = false }: { force?: boolean } = {}
  ): Promise<void> {
    if (
      op.config.code === StdOpCode.invokeWorkflow ||
      op.config.code === StdOpCode.sleep ||
      op.config.code === StdOpCode.waitForSignal
    ) {
      if (!force) {
        return;
      }
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
      if (!force) {
        // Retry by not storing the error
        return;
      }
    }

    const filePath = this.paths.opFile(runId, hashedOpId);
    await writeJsonFile(filePath, op);
  }
}
