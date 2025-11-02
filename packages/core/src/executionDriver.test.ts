import { describe, it, expect, vi } from "vitest";
import { BaseExecutionDriver, executeUntilDone, StepKitClient } from "./main";
import { OpResult, StdContext, StdStep } from "./types";
import { ReportOp } from "./process";
import { createOpFound, createStdStep } from "./executionDriver";

class StateDriver {
  private ops: Map<string, OpResult>;
  constructor() {
    this.ops = new Map();
  }

  async getContext(runId: string): Promise<Omit<StdContext, "step">> {
    return { runId };
  }

  getOp(id: { runId: string; hashedOpId: string }): OpResult | undefined {
    if (this.ops.has(id.hashedOpId)) {
      return this.ops.get(id.hashedOpId);
    }
    return undefined;
  }
  setOp(id: { runId: string; hashedOpId: string }, op: OpResult): void {
    this.ops.set(id.hashedOpId, op);
  }
}

describe("execute once", () => {
  const runId = "test-run-id";

  it("no steps success", async () => {
    // When no steps, interrupt with workflow result

    const driver = new BaseExecutionDriver(new StateDriver());
    const client = new StepKitClient({ driver });

    let counter = 0;
    const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
      counter++;
      return "Hello, Alice!";
    });
    const output = await driver.execute(workflow, runId);
    expect(counter).toBe(1);
    expect(output).toEqual([
      {
        config: { code: "workflow" },
        id: {
          hashed: "",
          id: "",
          index: 0,
        },
        result: {
          output: "Hello, Alice!",
          status: "success",
        },
      },
    ]);
  });

  it("no steps error", async () => {
    // When no steps, interrupt with workflow result

    const driver = new BaseExecutionDriver(new StateDriver());
    const client = new StepKitClient({ driver });

    let counter = 0;
    const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
      counter++;
      throw new Error("oh no");
    });
    const output = await driver.execute(workflow, runId);
    expect(counter).toBe(1);
    expect(output).toEqual([
      {
        config: { code: "workflow" },
        id: {
          hashed: "",
          id: "",
          index: 0,
        },
        result: {
          error: expect.any(Error),
          status: "error",
        },
      },
    ]);
  });

  it("step.run success", async () => {
    // When successfully running a step, interrupt with step result

    const driver = new BaseExecutionDriver(new StateDriver());
    const client = new StepKitClient({ driver });

    const counters = {
      top: 0,
      getName: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
      counters.top++;
      const name = await step.run("get-name", async () => {
        counters.getName++;
        return "Alice";
      });
      counters.bottom++;
      return `Hello, ${name}!`;
    });
    const result = await driver.execute(workflow, runId);
    expect(counters).toEqual({
      top: 1,
      getName: 1,
      bottom: 0,
    });
    expect(result).toEqual([
      {
        config: { code: "step.run" },
        id: {
          hashed: "get-name",
          id: "get-name",
          index: 0,
        },
        result: {
          output: "Alice",
          status: "success",
        },
      },
    ]);
  });

  it("step.run error", async () => {
    // When successfully running a step, interrupt with step result

    const driver = new BaseExecutionDriver(new StateDriver());
    const client = new StepKitClient({ driver });

    const counters = {
      top: 0,
      getName: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
      counters.top++;
      const name = await step.run("get-name", async () => {
        counters.getName++;
        throw new Error("oh no");
      });
      counters.bottom++;
      return `Hello, ${name}!`;
    });
    const result = await driver.execute(workflow, runId);
    expect(counters).toEqual({
      top: 1,
      getName: 1,
      bottom: 0,
    });
    expect(result).toEqual([
      {
        config: { code: "step.run" },
        id: {
          hashed: "get-name",
          id: "get-name",
          index: 0,
        },
        result: {
          error: expect.any(Error),
          status: "error",
        },
      },
    ]);
  });

  it("step.sleep", async () => {
    // When successfully running a step, interrupt with step result

    const driver = new BaseExecutionDriver(new StateDriver());
    const client = new StepKitClient({ driver });

    const counters = {
      top: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
      counters.top++;
      await step.sleep("zzz", 1000);
      counters.bottom++;
      return "Hello";
    });
    const start = Date.now();
    const result = await driver.execute(workflow, runId);

    // Did not actually sleep since we only reported it
    expect(Date.now() - start).toBeLessThan(100);

    expect(counters).toEqual({
      top: 1,
      bottom: 0,
    });
    expect(result).toStrictEqual([
      {
        config: {
          code: "step.sleep",
          options: { wakeupAt: expect.any(Date) },
        },
        id: {
          hashed: "zzz",
          id: "zzz",
          index: 0,
        },
        result: {
          output: undefined,
          status: "success",
        },
      },
    ]);
  });
});

describe("execute to completion", () => {
  const runId = "test-run-id";

  it("step.run success", async () => {
    // Keep looping through interrupts until the run completes

    const driver = new BaseExecutionDriver(new StateDriver());
    const client = new StepKitClient({ driver });

    const counters = {
      top: 0,
      getGreeting: 0,
      getName: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
      counters.top++;

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

    let allResults: OpResult[] = [];
    while (true) {
      const results = await driver.execute(workflow, runId);
      allResults = [...allResults, ...results];
      if (results[0].config.code === "workflow") {
        break;
      }
    }

    expect(counters).toEqual({
      top: 3,
      getGreeting: 1,
      getName: 1,
      bottom: 1,
    });
    expect(allResults).toEqual([
      {
        config: { code: "step.run" },
        id: {
          hashed: "get-greeting",
          id: "get-greeting",
          index: 0,
        },
        result: {
          output: "Hello",
          status: "success",
        },
      },
      {
        config: { code: "step.run" },
        id: {
          hashed: "get-name",
          id: "get-name",
          index: 0,
        },
        result: {
          output: "Alice",
          status: "success",
        },
      },
      {
        config: { code: "workflow" },
        id: {
          hashed: "",
          id: "",
          index: 0,
        },
        result: {
          output: "Hello, Alice!",
          status: "success",
        },
      },
    ]);
  });

  it("promise cleanup", async () => {
    // Ensure intentionally paused promises are deleted by the garbage
    // collector. This works because they don't have any references to them

    const driver = new BaseExecutionDriver(new StateDriver());
    const client = new StepKitClient({ driver });

    const heldValues = {
      greetingPromise: 0,
      namePromise: 0,
    };
    const registry = new FinalizationRegistry((heldValue) => {
      heldValues[heldValue as keyof typeof heldValues]++;
    });

    const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
      const greetingPromise = step.run("get-greeting", async () => {
        return "Hello";
      });
      registry.register(greetingPromise, "greetingPromise");
      const greeting = await greetingPromise;

      const namePromise = step.run("get-name", async () => {
        return "Alice";
      });
      registry.register(namePromise, "namePromise");
      const name = await namePromise;

      return `${greeting}, ${name}!`;
    });

    while (true) {
      const results = await driver.execute(workflow, runId);
      if (results[0].config.code === "workflow") {
        break;
      }
    }

    // Force garbage collection
    // @ts-expect-error
    globalThis.gc();

    // Need to poll our assertion because GC runs async
    await vi.waitFor(
      () => {
        expect(heldValues).toEqual({
          greetingPromise: 3,
          namePromise: 2,
        });
      },
      { timeout: 2000 }
    );
  });
});

it("custom step", async () => {
  // Define a custom step. Ensure that the step's logic is only called once

  const runId = "test-run-id";

  const counters = {
    workflowTop: 0,
    multiply: 0,
    workflowBottom: 0,
  };

  async function multiply(a: number, b: number): Promise<number> {
    counters.multiply++;
    return a * b;
  }

  type Step = StdStep & {
    multiply: (stepId: string, a: number, b: number) => Promise<number>;
  };

  class ExecutionDriver extends BaseExecutionDriver<StdContext, Step> {
    async getSteps(reportOp: ReportOp): Promise<Step> {
      return {
        ...createStdStep(reportOp),
        multiply: async (
          stepId: string,
          a: number,
          b: number
        ): Promise<number> => {
          return await createOpFound(
            reportOp,
            stepId,
            { code: "step.multiply" },
            () => multiply(a, b)
          );
        },
      };
    }
  }

  const driver = new ExecutionDriver(new StateDriver());
  const client = new StepKitClient({ driver });

  let result: number;
  const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
    counters.workflowTop++;
    result = await step.multiply("foo", 2, 3);
    counters.workflowBottom++;
    return result;
  });
  const ops = await driver.execute(workflow, "run-id");
  expect(counters).toEqual({
    workflowTop: 1,
    multiply: 1,
    workflowBottom: 0,
  });
  expect(ops).toEqual([
    {
      config: { code: "step.multiply" },
      id: {
        hashed: "foo",
        id: "foo",
        index: 0,
      },
      result: {
        output: 6,
        status: "success",
      },
    },
  ]);

  const output = await executeUntilDone(driver, workflow, runId);
  expect(output).toBe(6);
  expect(counters).toEqual({
    workflowTop: 2,
    multiply: 1,
    workflowBottom: 1,
  });
});
