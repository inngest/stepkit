function toJsonError(error: unknown): JsonError {
  let err: Error;
  if (error instanceof Error) {
    err = error;
  } else {
    err = new Error(String(error));
  }

  let cause: JsonError | undefined;
  if (err.cause !== undefined) {
    cause = toJsonError(err.cause);
  }

  return {
    cause,
    name: err.name,
    message: err.message,
    stack: err.stack,
  };
}

function fromJsonError(json: JsonError): Error {
  return new Error(json.message, {
    cause: json.cause ? fromJsonError(json.cause) : undefined,
    name: json.name,
    stack: json.stack,
  });
}

class MyError extends Error {
  specialData: string;

  constructor(message: string) {
    super(message);
    this.name = "MyError";
    this.specialData = "foo";
    this.cause = new Error("cause");
  }
}

const err = new MyError("oh no");

// console.log(JSON.stringify(err, null, 2));
