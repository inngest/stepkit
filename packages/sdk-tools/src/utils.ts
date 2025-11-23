import hash from "hash.js";

export function ensureAsync<T>(
  callback: (() => Promise<T>) | (() => T)
): () => Promise<T> {
  return async () => {
    return await callback();
  };
}

export type HashId = (id: string, index: number) => string;

// Standard hash function for op IDs
export function stdHashId(id: string, index: number): string {
  return hash.sha1().update(`${id}:${index.toString()}`).digest("hex");
}
