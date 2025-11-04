import type { StandardSchemaV1 } from "@standard-schema/spec";
import { z } from "zod";

// StepKit-specific error options. These will persist through JSON serialization
// and deserialization
const stepKitErrorPropsSchema = z.object({
  canRetry: z.boolean(),
});
export type StepKitErrorProps = z.infer<typeof stepKitErrorPropsSchema>;

function getStepKitProps(error: Error): StepKitErrorProps | undefined {
  if (!("~stepkit" in error)) {
    return undefined;
  }

  return stepKitErrorPropsSchema.parse(error["~stepkit"]);
}

class StepKitError extends Error {
  public ["~stepkit"]: StepKitErrorProps;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;

    this["~stepkit"] = {
      canRetry: true,
    };
  }
}

export class NonRetryableError extends StepKitError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;
    this["~stepkit"].canRetry = false;
  }
}

export class InvalidInputError extends NonRetryableError {
  constructor(issues: readonly StandardSchemaV1.Issue[]) {
    super("Invalid input", {
      cause: new Error(JSON.stringify(issues, null, 2)),
    });
    this.name = this.constructor.name;
  }
}

export class NestedStepError extends NonRetryableError {
  constructor({
    stepId,
    parentStepId,
  }: {
    stepId: string;
    parentStepId: string;
  }) {
    super(
      `Step is nested inside another step: ${stepId} inside ${parentStepId}`
    );
    this.name = this.constructor.name;
  }
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

  const props = getStepKitProps(err);
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
    error["~stepkit"] = props;
  }

  return error;
}
