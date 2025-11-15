import { readdir } from "node:fs/promises";

import { type QueueItem, type SortedQueue } from "../common/queue";
import {
  deleteFile,
  ensureDir,
  generateQueueFilename,
  readJsonFile,
  writeJsonFile,
} from "./utils/fs";
import { FileSystemPaths } from "./utils/paths";

type QueueType = "event" | "exec";

export class FileSystemSortedQueue<T> implements SortedQueue<T> {
  private paths: FileSystemPaths;
  private queueType: QueueType;

  constructor(baseDir: string, queueType: QueueType) {
    this.paths = new FileSystemPaths(baseDir);
    this.queueType = queueType;
  }

  async add(item: QueueItem<T>): Promise<void> {
    const filename = generateQueueFilename(item.time);
    const filePath = this.paths.queueFile(this.queueType, filename);

    // Ensure queue directory exists
    const queueDir = this.paths.queueDir(this.queueType);
    await ensureDir(queueDir);

    await writeJsonFile(filePath, item);
  }

  async getNext(): Promise<QueueItem<T> | undefined> {
    const queueDir = this.paths.queueDir(this.queueType);

    try {
      await ensureDir(queueDir);
      const files = await readdir(queueDir);

      if (files.length === 0) {
        return undefined;
      }

      // Files are already sorted lexicographically by filename (timestamp-uuid.json)
      const sortedFiles = files.sort();

      for (const filename of sortedFiles) {
        const filePath = this.paths.queueFile(this.queueType, filename);
        const item = await readJsonFile<QueueItem<T>>(filePath);

        if (item === undefined) {
          // File was deleted by another process, try next
          continue;
        }

        // Check if item is ready to be processed
        if (item.time > Date.now()) {
          return undefined;
        }

        // Try to delete the file (atomic dequeue)
        try {
          await deleteFile(filePath);
          return item;
        } catch {
          // File was likely deleted by another process (race condition)
          // Continue to next file
          continue;
        }
      }

      return undefined;
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      if ("code" in error && error.code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  handle(callback: (item: QueueItem<T>) => unknown): () => void {
    const interval = setInterval(() => {
      this.getNext()
        .then((item) => {
          if (item !== undefined) {
            callback(item);
          }
        })
        .catch((error: unknown) => {
          console.error("Error processing queue item:", error);
        });
    }, 50);

    const stop = (): void => {
      clearInterval(interval);
    };
    return stop;
  }
}
