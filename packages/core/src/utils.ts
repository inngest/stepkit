import hashjs from "hash.js";
import type { MaybePromise, OutgoingOp } from "./types.js";

const { sha1 } = hashjs;

export const hashId = (id: string): string => {
  return sha1().update(id).digest("hex");
};

export const hashOp = (op: OutgoingOp): OutgoingOp => {
  return {
    ...op,
    id: hashId(op.id),
  };
};

export interface DeferredPromise<T = unknown> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

export const createDeferredPromise = <T = unknown>(): DeferredPromise<T> => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

export const runAsPromise = <T>(fn: () => MaybePromise<T>): Promise<T> => {
  return Promise.resolve().then(fn);
};

export interface DeferredPromiseWithStack<T = unknown> {
  deferred: {
    resolve: (value: T) => {
      resolve: (value: T) => { resolve: (value: T) => any };
    };
  };
  results: AsyncGenerator<T, void, void>;
}

export const createDeferredPromiseWithStack = <
  T = unknown,
>(): DeferredPromiseWithStack<T> => {
  const stack: T[] = [];
  const waiters: Array<(value: IteratorResult<T>) => void> = [];

  const resolve = (value: T) => {
    const waiter = waiters.shift();
    if (waiter) {
      waiter({ value, done: false });
    } else {
      stack.push(value);
    }
    return { resolve };
  };

  const next = (): Promise<IteratorResult<T>> => {
    const value = stack.shift();
    if (value !== undefined) {
      return Promise.resolve({ value, done: false });
    }
    return new Promise((resolve) => waiters.push(resolve));
  };

  const results: AsyncGenerator<T, void, void> = {
    next,
    return: async () => {
      waiters.length = 0;
      stack.length = 0;
      return { value: undefined, done: true };
    },
    throw: async (error) => {
      throw error;
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };

  return {
    deferred: { resolve },
    results,
  };
};
