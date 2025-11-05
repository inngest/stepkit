import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { StepKitClient } from "@stepkit/core";
import type { JsonError } from "@stepkit/core/implementer";

import { InngestDriver } from "./driver";

type MockStepTools = {
  run: ReturnType<typeof vi.fn>;
  sleep: ReturnType<typeof vi.fn>;
};

function createMockStepTools(): MockStepTools {
  return {
    run: vi.fn(async (stepId: string, handler: () => unknown) => {
      return await handler();
    }),
    sleep: vi.fn(async (stepId: string, duration: number) => {
      return;
    }),
  };
}

describe("InngestDriver", () => {
  it("success", async () => {
    const stepTools = createMockStepTools();
    const client = new StepKitClient({
      driver: new InngestDriver(stepTools as any),
      id: "my-app",
    });

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
      top: 1,
      getGreeting: 1,
      getName: 1,
      bottom: 1,
    });
    expect(output).toEqual("Hello, Alice!");
    expect(stepTools.run).toHaveBeenCalledTimes(2);
    expect(stepTools.run).toHaveBeenCalledWith("get-greeting", expect.any(Function));
    expect(stepTools.run).toHaveBeenCalledWith("get-name", expect.any(Function));
  });

  it("fail", async () => {
    const stepTools = createMockStepTools();
    const client = new StepKitClient({
      driver: new InngestDriver(stepTools as any),
      id: "my-app",
    });

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
      top: 1,
      insideStep: 1,
      catch: 1,
      bottom: 0,
    });

    expect(errorInsideWorkflow).toBeInstanceOf(FooError);
    expect(errorInsideWorkflow?.message).toEqual("oh no");
    expect(errorInsideWorkflow?.cause).toBeInstanceOf(BarError);

    expect(errorOutsideWorkflow).toBeInstanceOf(FooError);
    expect(errorOutsideWorkflow?.message).toEqual("oh no");
    expect(errorOutsideWorkflow?.cause).toBeInstanceOf(BarError);
  });

  it("Inngest handles retries", async () => {
    let attemptCount = 0;
    const stepTools: MockStepTools = {
      run: vi.fn(async (stepId: string, handler: () => unknown) => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error("first attempt failed");
        }
        return await handler();
      }),
      sleep: vi.fn(),
    };

    const client = new StepKitClient({
      driver: new InngestDriver(stepTools as any),
      id: "my-app",
    });

    const counters = {
      top: 0,
      insideStep: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
      counters.top++;

      const output = await step.run("a", async () => {
        counters.insideStep++;
        return "hi";
      });

      counters.bottom++;
      return output;
    });

    let error: unknown;
    try {
      await workflow.invoke({});
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toEqual("first attempt failed");
    expect(counters).toEqual({
      top: 1,
      insideStep: 0,
      bottom: 0,
    });
  });

  it("invalid input", async () => {
    const stepTools = createMockStepTools();
    const client = new StepKitClient({
      driver: new InngestDriver(stepTools as any),
      id: "my-app",
    });

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
    const stepTools = createMockStepTools();
    const client = new StepKitClient({
      driver: new InngestDriver(stepTools as any),
      id: "my-app",
    });

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
      top: 1,
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

  it("sleep", async () => {
    const stepTools = createMockStepTools();
    const client = new StepKitClient({
      driver: new InngestDriver(stepTools as any),
      id: "my-app",
    });

    const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
      await step.sleep("wait", 1000);
      return "done";
    });

    const output = await workflow.invoke({});

    expect(output).toEqual("done");
    expect(stepTools.sleep).toHaveBeenCalledTimes(1);
    expect(stepTools.sleep).toHaveBeenCalledWith("wait", 1000);
  });

  it("context data", async () => {
    const stepTools = createMockStepTools();
    const client = new StepKitClient({
      driver: new InngestDriver(stepTools as any),
      id: "my-app",
    });

    let capturedContext: any;
    const workflow = client.workflow(
      {
        id: "workflow",
        inputSchema: z.object({ name: z.string(), age: z.number() }),
      },
      async (ctx) => {
        capturedContext = ctx;
        return `${ctx.input.data.name} is ${ctx.input.data.age}`;
      }
    );

    const output = await workflow.invoke({ name: "Alice", age: 30 });

    expect(output).toEqual("Alice is 30");
    expect(capturedContext.input.data).toEqual({ name: "Alice", age: 30 });
    expect(capturedContext.input.name).toEqual("inngest");
    expect(capturedContext.input.type).toEqual("invoke");
    expect(capturedContext.runId).toBeDefined();
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

  if (expected.cause !== undefined) {
    expect(actual.cause).toBeInstanceOf(Error);
    if (actual.cause instanceof Error) {
      expect(actual.cause.message).toEqual((expected.cause as any).message);
      expect(actual.cause.name).toEqual((expected.cause as any).name);
      expect(actual.cause.stack).toBeDefined();
    }
  }
}
