import type { StandardSchemaV1 } from "@standard-schema/spec";

export class InvalidInputError extends Error {
  constructor(issues: readonly StandardSchemaV1.Issue[]) {
    super("Invalid input", {
      cause: new Error(JSON.stringify(issues, null, 2)),
    });
    this.name = "InvalidInputError";
  }
}

// Errors be be serialized/deserialized as JSON. We'll store as much info as
// possible for reconstructing the error
export type JsonError = {
  cause?: JsonError;
  name: string;
  message: string;
  stack?: string;
};

// Convert an error to JSON
export function toJsonError(error: unknown): JsonError {
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

// Convert JSON to an error
export function fromJsonError(json: JsonError): Error {
  let cause: Error | undefined;
  if (json.cause !== undefined) {
    cause = fromJsonError(json.cause);
  }

  const error = new Error(json.message);
  error.name = json.name;
  error.stack = json.stack;
  error.cause = cause;
  return error;
}
