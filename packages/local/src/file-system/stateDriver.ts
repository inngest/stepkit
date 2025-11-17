import {
  StdOpCode,
  type Context,
  type OpResult,
  type OpResults,
} from "@stepkit/sdk-tools";

import type {
  LocalStateDriver,
  ResumeWaitForSignalOpOpts,
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

export class FileSystemStateDriver implements LocalStateDriver {
  private paths: FileSystemPaths;

  constructor(baseDir: string) {
    this.paths = new FileSystemPaths(baseDir);
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
