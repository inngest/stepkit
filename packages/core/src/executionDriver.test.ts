import { describe, expect, it, vi } from "vitest";

import { StepKitClient } from "./client";
import type { ReportOp } from "./findOps";
import {
  BaseExecutionDriver,
  createOpFound,
  createStdStep,
} from "./implementer";
import type { Context, ExtDefault, OpResult, Step } from "./types";
import { executeUntilDone, stdHashId } from "./utils";

class StateDriver {
  private ops: Map<string, OpResult>;
  constructor() {
    this.ops = new Map();
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

class ExecutionDriver extends BaseExecutionDriver {
  async getStep(reportOp: ReportOp): Promise<Step> {
    return createStdStep(stdHashId, reportOp);
  }
}

const ctx: Context = {
  ext: {},
  input: {
    data: {},
    ext: {},
    id: "test-input-id",
    name: "test-input-name",
    time: new Date(),
    type: "invoke",
  },
  runId: "test-run-id",
};

describe("execute once", () => {
  describe("no steps", () => {
    it("success", async () => {
      // When no steps, interrupt with workflow result

      const driver = new ExecutionDriver(new StateDriver());
      const client = new StepKitClient({ driver });

      let counter = 0;
      const workflow = client.workflow({ id: "workflow" }, async () => {
        counter++;
        return "Hello, Alice!";
      });
      const output = await driver.execute(workflow, ctx);
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

    it("error", async () => {
      // When no steps, interrupt with workflow result

      const driver = new ExecutionDriver(new StateDriver());
      const client = new StepKitClient({ driver });

      let counter = 0;
      const workflow = client.workflow({ id: "workflow" }, async () => {
        counter++;
        throw new Error("oh no");
      });
      const output = await driver.execute(workflow, ctx);
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
            error: {
              cause: undefined,
              name: "Error",
              message: "oh no",
              stack: expect.any(String),
            },
            status: "error",
          },
        },
      ]);
    });
  });

  describe("step.run", () => {
    it("success", async () => {
      // When successfully running a step, interrupt with step result

      const driver = new ExecutionDriver(new StateDriver());
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
      const result = await driver.execute(workflow, ctx);
      expect(counters).toEqual({
        top: 1,
        getName: 1,
        bottom: 0,
      });
      expect(result).toEqual([
        {
          config: { code: "step.run" },
          id: {
            hashed: "03b5f7de3b5d7975054984c1ae3fa120f622833e",
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

    it("error", async () => {
      // When successfully running a step, interrupt with step result

      const driver = new ExecutionDriver(new StateDriver());
      const client = new StepKitClient({ driver });

      const counters = {
        top: 0,
        getName: 0,
        bottom: 0,
      };
      const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
        counters.top++;
        await step.run("get-name", async () => {
          counters.getName++;
          throw new Error("oh no");
        });
        counters.bottom++;
      });
      const result = await driver.execute(workflow, ctx);
      expect(counters).toEqual({
        top: 1,
        getName: 1,
        bottom: 0,
      });
      expect(result).toEqual([
        {
          config: { code: "step.run" },
          id: {
            hashed: "03b5f7de3b5d7975054984c1ae3fa120f622833e",
            id: "get-name",
            index: 0,
          },
          result: {
            error: {
              cause: undefined,
              name: "Error",
              message: "oh no",
              stack: expect.any(String),
            },
            status: "error",
          },
        },
      ]);
    });
  });

  it("step.sleep", async () => {
    // When successfully running a step, interrupt with step result

    const driver = new ExecutionDriver(new StateDriver());
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
    const result = await driver.execute(workflow, ctx);

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
          hashed: "4cef13bd645056cd329243fd43c1e09b1dfebb9a",
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
  it("step.run success", async () => {
    // Keep looping through interrupts until the run completes

    const driver = new ExecutionDriver(new StateDriver());
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
      const results = await driver.execute(workflow, ctx);
      allResults = [...allResults, ...results];
      if (results[0]?.config.code === "workflow") {
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
          hashed: "3c53d28d711a44c677df82223b78a81fc42ff19e",
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
          hashed: "03b5f7de3b5d7975054984c1ae3fa120f622833e",
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

  it("parallel steps", async () => {
    // Parallel steps don't have any special logic. They'll just get passed to
    // `onStepsFound` as a single array

    const driver = new ExecutionDriver(new StateDriver());
    const client = new StepKitClient({ driver });

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

    let allResults: OpResult[][] = [];
    while (true) {
      const results = await driver.execute(workflow, ctx);
      allResults = [...allResults, results];
      if (results[0]?.config.code === "workflow") {
        break;
      }
    }

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
    expect(allResults).toEqual([
      [
        {
          config: { code: "step.run" },
          id: {
            hashed: "d616db3cc1276a33b72d526499c69671aa7c8ab5",
            id: "a",
            index: 0,
          },
          result: {
            output: "A",
            status: "success",
          },
        },
      ],
      [
        {
          config: { code: "step.run" },
          id: {
            hashed: "700134726669965a0c6dfd42804b6074307e0396",
            id: "p1",
            index: 0,
          },
          result: {
            output: "P1",
            status: "success",
          },
        },
        {
          config: { code: "step.run" },
          id: {
            hashed: "c1ffc96bef39f32722049847bd2b755c59b9148a",
            id: "p2",
            index: 0,
          },
          result: {
            output: "P2",
            status: "success",
          },
        },
      ],
      [
        {
          config: { code: "step.run" },
          id: {
            hashed: "312e91d4b6541e0599765a35fda6d39a5685d98d",
            id: "b",
            index: 0,
          },
          result: {
            output: "B",
            status: "success",
          },
        },
      ],
      [
        {
          config: { code: "workflow" },
          id: {
            hashed: "",
            id: "",
            index: 0,
          },
          result: {
            output: undefined,
            status: "success",
          },
        },
      ],
    ]);
  });

  it("promise cleanup", async () => {
    // Ensure intentionally paused promises are deleted by the garbage
    // collector. This works because they don't have any references to them

    const driver = new ExecutionDriver(new StateDriver());
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
      const results = await driver.execute(workflow, ctx);
      if (results[0]?.config.code === "workflow") {
        break;
      }
    }

    // Force garbage collection
    // @ts-expect-error - We enable GC during testing
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

  const counters = {
    workflowTop: 0,
    multiply: 0,
    workflowBottom: 0,
  };

  async function multiply(a: number, b: number): Promise<number> {
    counters.multiply++;
    return a * b;
  }

  type StepExt = {
    multiply: (stepId: string, a: number, b: number) => Promise<number>;
  };

  class ExecutionDriver extends BaseExecutionDriver<
    ExtDefault,
    ExtDefault,
    StepExt
  > {
    async getStep(reportOp: ReportOp): Promise<Step<StepExt>> {
      return {
        ...createStdStep(stdHashId, reportOp),
        ext: {
          multiply: async (
            stepId: string,
            a: number,
            b: number
          ): Promise<number> => {
            return await createOpFound(
              stdHashId,
              reportOp,
              stepId,
              { code: "step.multiply" },
              () => multiply(a, b)
            );
          },
        },
      };
    }
  }

  const driver = new ExecutionDriver(new StateDriver());
  const client = new StepKitClient({ driver });

  let result: number;
  const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
    counters.workflowTop++;
    result = await step.ext.multiply("foo", 2, 3);
    counters.workflowBottom++;
    return result;
  });
  const ops = await driver.execute(workflow, ctx);
  expect(counters).toEqual({
    workflowTop: 1,
    multiply: 1,
    workflowBottom: 0,
  });
  expect(ops).toEqual([
    {
      config: { code: "step.multiply" },
      id: {
        hashed: "187c5953271798be6a3b9c99a4ddf69f3ac19889",
        id: "foo",
        index: 0,
      },
      result: {
        output: 6,
        status: "success",
      },
    },
  ]);

  const output = await executeUntilDone(
    (ctx, workflow) => driver.execute(workflow, ctx),
    workflow,
    ctx
  );
  expect(output).toBe(6);
  expect(counters).toEqual({
    workflowTop: 2,
    multiply: 1,
    workflowBottom: 1,
  });
});
