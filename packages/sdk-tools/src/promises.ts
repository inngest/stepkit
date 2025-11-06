export type ControlledPromise<T> = {
  promise: Promise<T>;
  resolve: (value: T) => ControlledPromise<T>;
  reject: (reason: unknown) => ControlledPromise<T>;
  reset: () => void;
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

  const out = { promise, resolve, reject };

  const reset = () => {
    const newPromise = createControlledPromise<T>();
    out.promise = newPromise.promise;
    out.resolve = newPromise.resolve;
    out.reject = newPromise.reject;
    return out;
  };

  return { ...out, reset };
};
