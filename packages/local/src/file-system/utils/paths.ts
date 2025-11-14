import { join } from "node:path";

/**
 * Helper class to generate consistent file paths for the file system driver
 */
export class FileSystemPaths {
  constructor(private baseDir: string) {}

  runFile(runId: string): string {
    return join(this.baseDir, "runs", `${runId}.json`);
  }

  opFile(runId: string, hashedOpId: string): string {
    return join(this.baseDir, "ops", runId, `${hashedOpId}.json`);
  }

  opDir(runId: string): string {
    return join(this.baseDir, "ops", runId);
  }

  queueFile(queueType: "event" | "exec", filename: string): string {
    return join(this.baseDir, "queues", queueType, filename);
  }

  queueDir(queueType: "event" | "exec"): string {
    return join(this.baseDir, "queues", queueType);
  }

  signalFile(signal: string): string {
    return join(this.baseDir, "signals", `${signal}.json`);
  }

  getBaseDir(): string {
    return this.baseDir;
  }
}
