import fs from "node:fs/promises";
import { resolve } from "node:path";

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import z from "zod";

import { NonRetryableError } from "@stepkit/core";

import { FileSystemClient } from "../../src/main";
import { expectError } from "../utils";

const stateDir = resolve("./.stepkit/invoke-test");

export async function cleanup(): Promise<void> {
  try {
    await fs.rm(stateDir, { recursive: true, force: true });
  } catch {
    // Ignore
  }
}

describe("invoke", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  let client: FileSystemClient;
  beforeEach(() => {
    client = new FileSystemClient({
      baseDir: `${stateDir}/${crypto.randomUUID()}`,
    });
  });
  afterEach(() => client.stop());

  it("step.run", async () => {
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

    const output = await client.invoke(workflow, { msg: "hi" });

    expect(input.data).toEqual({ msg: "hi" });
    expect(counters).toEqual({
      top: 3,
      getGreeting: 1,
      getName: 1,
      bottom: 1,
    });
    expect(output).toEqual("Hello, Alice!");
  });

  it("step.sleep", async () => {
    const counters = {
      top: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async (ctx, step) => {
      counters.top++;
      await step.sleep("get-greeting", 1000);
      counters.bottom++;
    });

    const start = Date.now();
    await client.invoke(workflow, {});
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThan(999);
    expect(duration).toBeLessThan(1200);

    expect(counters).toEqual({
      top: 2,
      bottom: 1,
    });
  });

  it("duplicate step ID", async () => {
    // Duplicate step IDs are treated as different steps

    const counters = {
      top: 0,
      first: 0,
      second: 0,
      bottom: 0,
    };
    const outputs: Record<string, unknown> = {
      first: undefined,
      second: undefined,
    };
    const workflow = client.workflow({ id: "workflow" }, async (ctx, step) => {
      counters.top++;

      outputs.first = await step.run("duplicate", async () => {
        counters.first++;
        return "first";
      });

      outputs.second = await step.run("duplicate", async () => {
        counters.second++;
        return "second";
      });

      counters.bottom++;
    });

    await client.invoke(workflow, {});

    expect(counters).toEqual({
      top: 3,
      first: 1,
      second: 1,
      bottom: 1,
    });
    expect(outputs).toEqual({
      first: "first",
      second: "second",
    });
  });

  it("fail", async () => {
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
      await client.invoke(workflow, {});
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

    expect(await client.invoke(workflow, {})).toEqual("hi");

    expect(counters).toEqual({
      top: 3,
      insideStep: 2,
      bottom: 1,
    });
  });

  it("invalid input", async () => {
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
      await client.invoke(workflow, { name: 1 });
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
    const counters = {
      a: 0,
      p1: 0,
      p2: 0,
      b: 0,
    };
    const outputs: Record<string, unknown> = {
      a: undefined,
      parallel: undefined,
      b: undefined,
    };
    const workflow = client.workflow({ id: "workflow" }, async (ctx, step) => {
      outputs.a = await step.run("a", async () => {
        counters.a++;
        return "A";
      });

      outputs.parallel = await Promise.all([
        step.run("p1", async () => {
          counters.p1++;
          return "P1";
        }),
        step.run("p2", async () => {
          counters.p2++;
          return "P2";
        }),
        step.sleep("p3", 1000),
        step.sleep("p4", 2000),
      ]);

      outputs.b = await step.run("b", async () => {
        counters.b++;
        return "B";
      });
    });

    const start = Date.now();
    await client.invoke(workflow, {});
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThan(1999);

    // Sometimes it takes upwards of 3.5 seconds. It's unclear why
    expect(duration).toBeLessThan(4000);

    expect(counters).toEqual({
      a: 1,
      p1: 1,
      p2: 1,
      b: 1,
    });
    expect(outputs).toEqual({
      a: "A",
      parallel: ["P1", "P2", undefined, undefined],
      b: "B",
    });
  });

  it("nested steps", async () => {
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
      await client.invoke(workflow, {});
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
      await client.invoke(workflow, {});
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
