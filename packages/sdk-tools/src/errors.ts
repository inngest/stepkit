import { z } from "zod";

import {
  stepKitErrorPropKey,
  type StepKitErrorProps,
} from "@stepkit/core/implementer";

// Only use for code blocks that should be truly unreachable. We should never
// actually throw this error
export class UnreachableError extends Error {
  constructor(message: string) {
    super(`unreachable: ${message}`);
    this.name = this.constructor.name;
  }
}

// StepKit-specific error options. These will persist through JSON serialization
// and deserialization
const stepKitErrorPropsSchema = z.object({
  canRetry: z.boolean(),
}) satisfies z.ZodType<StepKitErrorProps>;

export function getStepKitErrorProps(
  error: Error
): StepKitErrorProps | undefined {
  if (!(stepKitErrorPropKey in error)) {
    return undefined;
  }

  return stepKitErrorPropsSchema.parse(error[stepKitErrorPropKey]);
}

export function disableRetries(error: JsonError): JsonError {
  return {
    ...error,
    props: {
      ...error.props,
      canRetry: false,
    },
  };
}

// Errors be be serialized/deserialized as JSON. We'll store as much info as
// possible for reconstructing the error
export type JsonError = {
  cause?: unknown;
  name: string;
  message: string;
  props?: StepKitErrorProps;
  stack?: string;
};

// Convert an error to JSON
export function toJsonError(error: unknown): JsonError {
  let err: Error;
  if (error instanceof Error) {
    err = error;
  } else {
    // Coerce to an error
    err = new Error(String(error));
  }

  // TODO: Cause may not be an error, so we should not coerce it
  let cause: unknown;
  if (err.cause instanceof Error) {
    cause = toJsonError(err.cause);
  } else if (err.cause !== undefined) {
    // Coerce to JSON
    cause = JSON.parse(JSON.stringify(err.cause));
  }

  const out: JsonError = {
    cause,
    name: err.name,
    message: err.message,
    stack: err.stack,
  };

  const props = getStepKitErrorProps(err);
  if (props !== undefined) {
    out.props = props;
  }

  return out;
}

// Convert JSON to an error
export function fromJsonError(json: JsonError): Error {
  const error = new Error(json.message);
  error.name = json.name;
  error.stack = json.stack;
  error.cause = json.cause;

  if (json.props !== undefined) {
    const props = stepKitErrorPropsSchema.parse(json.props);

    // @ts-expect-error - The return type must be Error because we can't
    // reconstruct the error class
    error[stepKitErrorPropKey] = props;
  }

  return error;
}
