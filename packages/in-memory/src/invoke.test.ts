import { describe, expect, it } from "vitest";

import { StepKitClient } from "@stepkit/core";
import type { JsonError } from "@stepkit/core/implementer";

import { InMemoryDriver } from "./drivers";

describe("invoke", () => {
  it("success", async () => {
    const client = new StepKitClient({ driver: new InMemoryDriver() });

    let input: Record<string, unknown>[] = [];
    const counters = {
      top: 0,
      getGreeting: 0,
      getName: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async (ctx, step) => {
      counters.top++;
      input = ctx.input;

      const greeting = await step.run("get-greeting", async () => {
        counters.getGreeting++;
        return "Hello";
      });

      const name = await step.run("get-name", async () => {
        counters.getName++;
        return "Alice";
      });

      counters.bottom++;
      return `${greeting}, ${name}!`;
    });

    const output = await workflow.invoke({ msg: "hi" });

    expect(input).toEqual([{ msg: "hi" }]);
    expect(counters).toEqual({
      top: 3,
      getGreeting: 1,
      getName: 1,
      bottom: 1,
    });
    expect(output).toEqual("Hello, Alice!");
  });

  it("fail", async () => {
    const client = new StepKitClient({ driver: new InMemoryDriver() });

    class FooError extends Error {
      constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "FooError";
      }
    }

    class BarError extends Error {
      constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "BarError";
      }
    }

    let errorInsideWorkflow: Error | undefined;
    const counters = {
      top: 0,
      insideStep: 0,
      catch: 0,
      bottom: 0,
    };
    const workflow = client.workflow(
      { id: "workflow", maxAttempts: 2 },
      async (_, step) => {
        counters.top++;

        try {
          await step.run("a", async () => {
            counters.insideStep++;
            throw new FooError("oh no", { cause: new BarError("the cause") });
          });
        } catch (e) {
          counters.catch++;
          errorInsideWorkflow = e as Error;
          throw e;
        }

        counters.bottom++;
        return "hi";
      }
    );

    let errorOutsideWorkflow: Error | undefined;
    try {
      await workflow.invoke({});
    } catch (e) {
      errorOutsideWorkflow = e as Error;
    }

    expect(counters).toEqual({
      top: 4,
      insideStep: 2,
      catch: 2,
      bottom: 0,
    });

    // Actual type is `Error`, regardless of the type when thrown. This is
    // because of JSON serialization
    expect(errorInsideWorkflow).toBeInstanceOf(Error);

    expectError(errorInsideWorkflow, {
      message: "oh no",
      name: "FooError",
      cause: {
        message: "the cause",
        name: "BarError",
      },
    });

    // Actual type is `Error`, regardless of the type when thrown. This is
    // because of JSON serialization
    expect(errorOutsideWorkflow).toBeInstanceOf(Error);

    expectError(errorOutsideWorkflow, {
      message: "oh no",
      name: "FooError",
      cause: {
        message: "the cause",
        name: "BarError",
      },
    });
  });

  it("successful retry", async () => {
    const client = new StepKitClient({ driver: new InMemoryDriver() });

    const counters = {
      top: 0,
      insideStep: 0,
      bottom: 0,
    };
    const workflow = client.workflow(
      { id: "workflow" },
      async ({ attempt }, step) => {
        counters.top++;

        const output = await step.run("a", async () => {
          counters.insideStep++;
          if (attempt === 0) {
            throw new Error("oh no");
          }
          return "hi";
        });

        counters.bottom++;
        return output;
      }
    );

    expect(await workflow.invoke({})).toEqual("hi");

    expect(counters).toEqual({
      top: 3,
      insideStep: 2,
      bottom: 1,
    });
  });
});

function expectError(actual: unknown, expected: JsonError) {
  expect(actual).toBeInstanceOf(Error);
  if (!(actual instanceof Error)) {
    throw new Error("unreachable");
  }

  expect(actual.message).toEqual(expected.message);
  expect(actual.name).toEqual(expected.name);
  expect(actual.stack).toEqual(expect.any(String));

  if (expected.cause === undefined) {
    expect(actual.cause).toBeUndefined();
    return;
  }

  expectError(actual.cause, expected.cause);
}
