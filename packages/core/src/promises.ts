export type ControlledPromise<T> = {
  promise: Promise<T>;
  resolve: (value: T) => ControlledPromise<T>;
  reject: (reason: unknown) => ControlledPromise<T>;
  reset: () => void;
};

export const createControlledPromise = <T = void>(): ControlledPromise<T> => {
  let resolve: ControlledPromise<T>["resolve"];
  let reject: ControlledPromise<T>["reject"];

  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = (value: T) => {
      _resolve(value);
      return createControlledPromise<T>();
    };

    reject = (reason: unknown) => {
      _reject(reason);
      return createControlledPromise<T>();
    };
  });

  const out = { promise, resolve: resolve!, reject: reject! };

  const reset = () => {
    const newPromise = createControlledPromise<T>();
    out.promise = newPromise.promise;
    out.resolve = newPromise.resolve;
    out.reject = newPromise.reject;
    return out;
  };

  return { ...out, reset };
};
