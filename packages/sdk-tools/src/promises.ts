export type ControlledPromise<T> = {
  promise: Promise<T>;
  resolve: (value: T) => ControlledPromise<T>;
  reject: (reason: unknown) => ControlledPromise<T>;
};

export const createControlledPromise = <T = void>(): ControlledPromise<T> => {
  let resolve: ControlledPromise<T>["resolve"] | undefined;
  let reject: ControlledPromise<T>["reject"] | undefined;

  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = (value: T) => {
      _resolve(value);
      return createControlledPromise<T>();
    };

    reject = (reason: unknown) => {
      let error: Error;
      if (reason instanceof Error) {
        error = reason;
      } else {
        error = new Error(String(reason));
      }
      _reject(error);
      return createControlledPromise<T>();
    };
  });

  if (resolve === undefined || reject === undefined) {
    throw new Error("unreachable");
  }

  return { promise, resolve, reject };
};

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Only allow one in-flight call at a time. Multiple in-flight calls will wait
 * for the first one to complete.
 */
export async function singleFlight<T>(
  idempotencyKey: string,
  callback: () => Promise<T>
): Promise<T> {
  const existing = inFlight.get(idempotencyKey);
  if (existing !== undefined) {
    return existing as T;
  }

  const promise = callback().finally(() => {
    inFlight.delete(idempotencyKey);
  });

  inFlight.set(idempotencyKey, promise);
  return promise;
}
