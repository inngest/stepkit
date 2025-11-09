import { expect } from "vitest";

import type { JsonError } from "@stepkit/sdk-tools";

export function expectError(actual: unknown, expected: JsonError): void {
  expect(actual).toBeInstanceOf(Error);
  if (!(actual instanceof Error)) {
    throw new Error("unreachable");
  }

  expect(actual.message).toEqual(expected.message);
  expect(actual.name).toEqual(expected.name);
  expect(actual.stack).toEqual(expect.any(String));
  expect(actual.cause).toEqual(expected.cause);
}
