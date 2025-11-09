import fs from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Atomic write: write to temp file, then rename. This prevents partial writes
 * on crashes as rename is atomic on most file systems
 */
async function writeFileAtomic(path: string, data: string): Promise<void> {
  const tmpPath = `${path}.tmp`;
  await fs.writeFile(tmpPath, data, "utf-8");
  await fs.rename(tmpPath, path);
}

/**
 * Safe read with JSON parse. Returns undefined if file doesn't exist
 */
export async function readJsonFile<T>(path: string): Promise<T | undefined> {
  try {
    const data: unknown = JSON.parse(await fs.readFile(path, "utf-8"));

    // @ts-expect-error - Necessary because of generics
    return data;
  } catch (error) {
    if (!(error instanceof Error)) {
      throw Error(String(error));
    }
    if ("code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

/**
 * Safe write with JSON stringify and atomic write
 */
export async function writeJsonFile(
  path: string,
  data: unknown
): Promise<void> {
  await ensureDir(dirname(path));
  await writeFileAtomic(path, JSON.stringify(data, null, 2));
}

/**
 * Ensure directory exists
 */
export async function ensureDir(path: string): Promise<void> {
  await fs.mkdir(path, { recursive: true });
}

/**
 * Generate queue filename with sortable timestamp. Format is
 * "{milliseconds}-{uuid}.json"
 */
export function generateQueueFilename(): string {
  const timestamp = Date.now().toString().padStart(13, "0");
  const uuid = crypto.randomUUID();
  return `${timestamp}-${uuid}.json`;
}

/**
 * Safe delete file (doesn't throw if file doesn't exist)
 */
export async function deleteFile(path: string): Promise<void> {
  try {
    await fs.unlink(path);
  } catch (error) {
    if (!(error instanceof Error)) {
      throw Error(String(error));
    }
    if ("code" in error && error.code !== "ENOENT") {
      throw error;
    }
    throw error;
  }
}
