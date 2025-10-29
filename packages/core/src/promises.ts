type DeferredPromiseReturn<T> = {
  promise: Promise<T>;
  resolve: (value: T) => DeferredPromiseReturn<T>;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  reject: (reason: any) => DeferredPromiseReturn<T>;
};
/**
 * Creates and returns Promise that can be resolved or rejected with the
 * returned `resolve` and `reject` functions.
 *
 * Resolving or rejecting the function will return a new set of Promise control
 * functions. These can be ignored if the original Promise is all that's needed.
 */
export const createDeferredPromise = <T>(): DeferredPromiseReturn<T> => {
  let resolve: DeferredPromiseReturn<T>['resolve'];
  let reject: DeferredPromiseReturn<T>['reject'];

  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = (value: T) => {
      _resolve(value);
      return createDeferredPromise<T>();
    };

    reject = (reason) => {
      _reject(reason);
      return createDeferredPromise<T>();
    };
  });

  return { promise, resolve: resolve!, reject: reject! };
};

/**
 * Creates and returns a deferred Promise that can be resolved or rejected with
 * the returned `resolve` and `reject` functions.
 *
 * For each Promise resolved or rejected this way, this will also keep a stack
 * of all unhandled Promises, resolved or rejected.
 *
 * Once a Promise is read, it is removed from the stack.
 */
export const createDeferredPromiseWithStack = <T>(): {
  deferred: DeferredPromiseReturn<T>;
  results: AsyncGenerator<Awaited<T>, void, void>;
} => {
  const settledPromises: Promise<T>[] = [];
  // biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
  let rotateQueue: (value: void) => void = () => {};

  const results = (async function* () {
    while (true) {
      const next = settledPromises.shift();

      if (next) {
        yield next;
      } else {
        await new Promise<void>((resolve) => {
          rotateQueue = resolve;
        });
      }
    }
  })();

  const shimDeferredPromise = (deferred: DeferredPromiseReturn<T>) => {
    const originalResolve = deferred.resolve;
    const originalReject = deferred.reject;

    deferred.resolve = (value: T) => {
      settledPromises.push(deferred.promise);
      rotateQueue();
      return shimDeferredPromise(originalResolve(value));
    };

    deferred.reject = (reason) => {
      settledPromises.push(deferred.promise);
      rotateQueue();
      return shimDeferredPromise(originalReject(reason));
    };

    return deferred;
  };

  const deferred = shimDeferredPromise(createDeferredPromise<T>());

  return { deferred, results };
};
