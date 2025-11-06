import type { StandardSchemaV1 } from "@standard-schema/spec";

// StepKit-specific error options. These will persist through JSON serialization
// and deserialization
export type StepKitErrorProps = {
  canRetry: boolean;
};

export class StepKitError extends Error {
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
