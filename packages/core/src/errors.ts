import type { StandardSchemaV1 } from "@standard-schema/spec";

export const stepKitErrorPropKey = "~stepkit";

// StepKit-specific error options. These will persist through JSON serialization
// and deserialization
export type StepKitErrorProps = {
  canRetry: boolean;
  errorClass?: string;
};

export class StepKitError extends Error {
  public [stepKitErrorPropKey]: StepKitErrorProps;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;

    this[stepKitErrorPropKey] = {
      canRetry: true,
      errorClass: this.constructor.name,
    };
  }
}

export class NonRetryableError extends StepKitError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;
    this[stepKitErrorPropKey].canRetry = false;
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

export class InvokeTimeoutError extends NonRetryableError {
  constructor({ childRunId }: { childRunId: string }) {
    super(`invoked run ${childRunId} timed out`);
    this.name = this.constructor.name;
  }
}
