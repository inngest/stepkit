import { describe, expect, it } from "vitest";
import { z } from "zod";

import { NonRetryableError, StepKitClient } from "@stepkit/core";
import type { JsonError } from "@stepkit/core/implementer";

import { InMemoryDriver } from "./drivers";

describe("invoke", () => {
  it("success", async () => {
    const client = new StepKitClient({ driver: new InMemoryDriver() });

    let input: Record<string, unknown> = {};
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

    expect(input.data).toEqual({ msg: "hi" });
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
        stack: expect.any(String),
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
        stack: expect.any(String),
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
    const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
      counters.top++;

      const output = await step.run("a", async () => {
        counters.insideStep++;
        if (counters.insideStep === 1) {
          throw new Error("oh no");
        }
        return "hi";
      });

      counters.bottom++;
      return output;
    });

    expect(await workflow.invoke({})).toEqual("hi");

    expect(counters).toEqual({
      top: 3,
      insideStep: 2,
      bottom: 1,
    });
  });

  it("invalid input", async () => {
    const client = new StepKitClient({ driver: new InMemoryDriver() });

    let counter = 0;
    const workflow = client.workflow(
      {
        id: "workflow",
        inputSchema: z.object({ name: z.string() }),
      },
      async () => {
        counter++;
      }
    );

    let error: unknown;
    try {
      // @ts-expect-error - Intentional invalid input
      await workflow.invoke({ name: 1 });
    } catch (e) {
      error = e;
    }

    expectError(error, {
      message: "Invalid input",
      name: "InvalidInputError",
      cause: {
        message: JSON.stringify(
          [
            {
              expected: "string",
              code: "invalid_type",
              path: ["name"],
              message: "Invalid input: expected string, received number",
            },
          ],
          null,
          2
        ),
        name: "Error",
        stack: expect.any(String),
      },
    });
    expect(counter).toEqual(0);
  });

  it("parallel steps", async () => {
    const client = new StepKitClient({ driver: new InMemoryDriver() });

    const counters = {
      top: 0,
      a: 0,
      p1: 0,
      p2: 0,
      b: 0,
      bottom: 0,
    };
    const outputs: Record<string, unknown> = {
      a: undefined,
      b: undefined,
    };
    const workflow = client.workflow({ id: "workflow" }, async (ctx, step) => {
      counters.top++;

      outputs.a = await step.run("a", async () => {
        counters.a++;
        return "A";
      });

      const results = await Promise.all([
        step.run("p1", async () => {
          counters.p1++;
          return "P1";
        }),
        step.run("p2", async () => {
          counters.p2++;
          return "P2";
        }),
      ]);
      outputs.p1 = results[0];
      outputs.p2 = results[1];

      outputs.b = await step.run("b", async () => {
        counters.b++;
        return "B";
      });

      counters.bottom++;
    });

    await workflow.invoke({});

    expect(counters).toEqual({
      top: 4,
      a: 1,
      p1: 1,
      p2: 1,
      b: 1,
      bottom: 1,
    });
    expect(outputs).toEqual({
      a: "A",
      p1: "P1",
      p2: "P2",
      b: "B",
    });
  });

  it("nested steps", async () => {
    const client = new StepKitClient({ driver: new InMemoryDriver() });

    const counters = {
      top: 0,
      a: 0,
      b: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
      counters.top++;

      await step.run("a", async () => {
        counters.a++;
        await step.run("b", async () => {
          counters.b++;
        });
      });

      counters.bottom++;
    });

    let error: unknown;
    try {
      await workflow.invoke({});
    } catch (e) {
      error = e;
    }

    expect(counters).toEqual({
      top: 1,
      a: 1,
      b: 0,
      bottom: 0,
    });
    expectError(error, {
      message: "Step is nested inside another step: b inside a",
      name: "NestedStepError",
    });
  });

  it("NonRetryableError", async () => {
    const client = new StepKitClient({ driver: new InMemoryDriver() });

    class MyError extends Error {
      constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = this.constructor.name;
      }
    }

    const counters = {
      top: 0,
      insideStep: 0,
      bottom: 0,
    };
    const workflow = client.workflow(
      { id: "workflow", maxAttempts: 2 },
      async (_, step) => {
        counters.top++;

        await step.run("a", async () => {
          counters.insideStep++;
          throw new NonRetryableError("oh no", {
            cause: new MyError("the cause"),
          });
        });

        counters.bottom++;
      }
    );

    let errorOutsideWorkflow: Error | undefined;
    try {
      await workflow.invoke({});
    } catch (e) {
      errorOutsideWorkflow = e as Error;
    }

    expect(counters).toEqual({
      top: 1,
      insideStep: 1,
      bottom: 0,
    });

    // Actual type is `Error`, regardless of the type when thrown. This is
    // because of JSON serialization
    expect(errorOutsideWorkflow).toBeInstanceOf(Error);

    expectError(errorOutsideWorkflow, {
      message: "oh no",
      name: "NonRetryableError",
      cause: {
        message: "the cause",
        name: "MyError",
        stack: expect.any(String),
      },
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
  expect(actual.cause).toEqual(expected.cause);
}
