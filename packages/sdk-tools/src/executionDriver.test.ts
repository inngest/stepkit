import { describe, expect, it } from "vitest";

import { type Workflow } from "@stepkit/core";
import {
  type Context,
  type ExtDefault,
  type InputDefault,
  type SendSignalOpts,
  type StartData,
  type Step,
} from "@stepkit/core/implementer";

import { BaseClient } from "./client";
import { insideStep } from "./executionDriver";
import type { ReportOp } from "./findOps";
import {
  BaseExecutionDriver,
  createOpFound,
  createStdStep,
  OpMode,
} from "./main";
import type { OpResult } from "./types";

class StateDriver {
  private ops: Map<string, OpResult>;
  constructor() {
    this.ops = new Map();
  }

  async getOp(_id: {
    runId: string;
    hashedOpId: string;
  }): Promise<OpResult | undefined> {
    return undefined;
  }

  async setOp(
    _id: { runId: string; hashedOpId: string },
    _op: OpResult
  ): Promise<void> {
    return;
  }
}

class MyClient extends BaseClient {
  sendSignal(_opts: SendSignalOpts): Promise<{ runId: string | null }> {
    throw new Error("not implemented");
  }

  startWorkflow<TInput extends InputDefault>(
    _workflow: Workflow<TInput, any>,
    _input: TInput
  ): Promise<StartData> {
    throw new Error("not implemented");
  }
}

class ExecutionDriver extends BaseExecutionDriver {
  async getStep(reportOp: ReportOp): Promise<Step> {
    return createStdStep(reportOp);
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

describe("no steps", () => {
  it("success", async () => {
    // When no steps, interrupt with workflow result

    const driver = new ExecutionDriver(new StateDriver());
    const client = new MyClient();

    let counter = 0;
    const workflow = client.workflow({ id: "workflow" }, async () => {
      counter++;
      return "Hello, Alice!";
    });
    const output = await driver.execute({ ctx, workflow });
    expect(counter).toBe(1);
    expect(output).toEqual([
      {
        config: {
          code: "workflow",
          mode: OpMode.immediate,
        },
        opId: {
          hashed: "",
          id: "",
          index: 0,
        },
        result: {
          output: "Hello, Alice!",
          status: "success",
        },
        runId: "test-run-id",
        workflowId: "workflow",
      },
    ] satisfies OpResult[]);
  });

  it("error", async () => {
    // When no steps, interrupt with workflow result

    const driver = new ExecutionDriver(new StateDriver());
    const client = new MyClient();

    let counter = 0;
    const workflow = client.workflow({ id: "workflow" }, async () => {
      counter++;
      throw new Error("oh no");
    });
    const output = await driver.execute({ ctx, workflow });
    expect(counter).toBe(1);
    expect(output).toEqual([
      {
        config: {
          code: "workflow",
          mode: OpMode.immediate,
        },
        opId: {
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
        runId: "test-run-id",
        workflowId: "workflow",
      },
    ] satisfies OpResult[]);
  });
});

describe("step.run", () => {
  it("success", async () => {
    // When successfully running a step, interrupt with step result

    const driver = new ExecutionDriver(new StateDriver());
    const client = new MyClient();

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
    const result = await driver.execute({ ctx, workflow });
    expect(counters).toEqual({
      top: 1,
      getName: 1,
      bottom: 0,
    });
    expect(result).toEqual([
      {
        config: {
          code: "step.run",
          mode: OpMode.immediate,
        },
        opId: {
          hashed: "03b5f7de3b5d7975054984c1ae3fa120f622833e",
          id: "get-name",
          index: 0,
        },
        result: {
          output: "Alice",
          status: "success",
        },
        runId: "test-run-id",
        workflowId: "workflow",
      },
    ] satisfies OpResult[]);
  });

  it("error", async () => {
    // When successfully running a step, interrupt with step result

    const driver = new ExecutionDriver(new StateDriver());
    const client = new MyClient();

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
    const result = await driver.execute({ ctx, workflow });
    expect(counters).toEqual({
      top: 1,
      getName: 1,
      bottom: 0,
    });
    expect(result).toEqual([
      {
        config: {
          code: "step.run",
          mode: OpMode.immediate,
        },
        opId: {
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
        runId: "test-run-id",
        workflowId: "workflow",
      },
    ] satisfies OpResult[]);
  });
});

it("step.sleep", async () => {
  // When successfully running a step, interrupt with step result

  const driver = new ExecutionDriver(new StateDriver());
  const client = new MyClient();

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
  const result = await driver.execute({ ctx, workflow });

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
        mode: OpMode.scheduled,
        options: { wakeAt: expect.any(Number) },
      },
      opId: {
        hashed: "4cef13bd645056cd329243fd43c1e09b1dfebb9a",
        id: "zzz",
        index: 0,
      },
      result: { status: "plan" },
      runId: "test-run-id",
      workflowId: "workflow",
    },
  ] satisfies OpResult[]);
});

describe("parallel steps", () => {
  it("no target op", async () => {
    // When no target op, ops are planned

    const driver = new ExecutionDriver(new StateDriver());
    const client = new MyClient();

    const counters = {
      top: 0,
      stepA: 0,
      stepB: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
      counters.top++;
      await Promise.all([
        step.run("a", async () => {
          counters.stepA++;
          return "A";
        }),
        step.run("b", async () => {
          counters.stepB++;
          return "B";
        }),
      ]);
      counters.bottom++;
      return "Hello";
    });

    const ops = await driver.execute({ ctx, workflow });
    expect(counters).toEqual({
      top: 1,
      stepA: 0,
      stepB: 0,
      bottom: 0,
    });
    expect(ops).toHaveLength(2);
    expect(ops).toStrictEqual([
      {
        config: {
          code: "step.run",
          mode: OpMode.immediate,
        },
        opId: {
          hashed: "d616db3cc1276a33b72d526499c69671aa7c8ab5",
          id: "a",
          index: 0,
        },
        result: { status: "plan" },
        runId: "test-run-id",
        workflowId: "workflow",
      },
      {
        config: {
          code: "step.run",
          mode: OpMode.immediate,
        },
        opId: {
          hashed: "312e91d4b6541e0599765a35fda6d39a5685d98d",
          id: "b",
          index: 0,
        },
        result: { status: "plan" },
        runId: "test-run-id",
        workflowId: "workflow",
      },
    ] satisfies OpResult[]);
  });

  it("target op", async () => {
    // When targeting an op, only the target op is executed

    const driver = new ExecutionDriver(new StateDriver());
    const client = new MyClient();

    const counters = {
      top: 0,
      stepA: 0,
      stepB: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
      counters.top++;
      await Promise.all([
        step.run("a", async () => {
          counters.stepA++;
          return "A";
        }),
        step.run("b", async () => {
          counters.stepB++;
          return "B";
        }),
      ]);
      counters.bottom++;
      return "Hello";
    });

    const expectedStepAPlan: OpResult = {
      config: {
        code: "step.run",
        mode: OpMode.immediate,
      },
      opId: {
        hashed: "d616db3cc1276a33b72d526499c69671aa7c8ab5",
        id: "a",
        index: 0,
      },
      result: { status: "plan" },
      runId: "test-run-id",
      workflowId: "workflow",
    };

    const expectedStepBPlan: OpResult = {
      config: {
        code: "step.run",
        mode: OpMode.immediate,
      },
      opId: {
        hashed: "312e91d4b6541e0599765a35fda6d39a5685d98d",
        id: "b",
        index: 0,
      },
      result: { status: "plan" },
      runId: "test-run-id",
      workflowId: "workflow",
    };

    // When targeting step "a", only step "a" is executed. Step "b" is planned
    const stepAHash = "d616db3cc1276a33b72d526499c69671aa7c8ab5";
    let ops = await driver.execute({
      ctx,
      targetHashedOpId: stepAHash,
      workflow,
    });
    expect(counters).toEqual({
      top: 1,
      stepA: 1,
      stepB: 0,
      bottom: 0,
    });
    expect(ops).toHaveLength(2);
    expect(ops).toStrictEqual([
      {
        ...expectedStepAPlan,
        result: {
          output: "A",
          status: "success",
        },
      },
      expectedStepBPlan,
    ] satisfies OpResult[]);

    // When targeting step "b", only step "b" is executed. Step "a" is planned
    const stepBHash = "312e91d4b6541e0599765a35fda6d39a5685d98d";
    ops = await driver.execute({
      ctx,
      targetHashedOpId: stepBHash,
      workflow,
    });
    expect(counters).toEqual({
      top: 2,
      stepA: 1,
      stepB: 1,
      bottom: 0,
    });
    expect(ops).toHaveLength(2);
    expect(ops).toStrictEqual([
      expectedStepAPlan,
      {
        ...expectedStepBPlan,
        result: {
          status: "success",
          output: "B",
        },
      },
    ] satisfies OpResult[]);
  });

  it("target op not found", async () => {
    // When targeting an op that doesn't exist, no ops are executed

    const driver = new ExecutionDriver(new StateDriver());
    const client = new MyClient();

    const counters = {
      top: 0,
      stepA: 0,
      stepB: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
      counters.top++;
      await Promise.all([
        step.run("a", async () => {
          counters.stepA++;
          return "A";
        }),
        step.run("b", async () => {
          counters.stepB++;
          return "B";
        }),
      ]);
      counters.bottom++;
      return "Hello";
    });

    const nonExistentOpHash = "0000000000000000000000000000000000000000";
    const ops = await driver.execute({
      ctx,
      targetHashedOpId: nonExistentOpHash,
      workflow,
    });
    expect(counters).toEqual({
      top: 1,
      stepA: 0,
      stepB: 0,
      bottom: 0,
    });
    expect(ops).toHaveLength(2);
    expect(ops).toStrictEqual([
      {
        config: {
          code: "step.run",
          mode: OpMode.immediate,
        },
        opId: {
          hashed: "d616db3cc1276a33b72d526499c69671aa7c8ab5",
          id: "a",
          index: 0,
        },
        result: { status: "plan" },
        runId: "test-run-id",
        workflowId: "workflow",
      },
      {
        config: {
          code: "step.run",
          mode: OpMode.immediate,
        },
        opId: {
          hashed: "312e91d4b6541e0599765a35fda6d39a5685d98d",
          id: "b",
          index: 0,
        },
        result: { status: "plan" },
        runId: "test-run-id",
        workflowId: "workflow",
      },
    ] satisfies OpResult[]);
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

  class MyClient extends BaseClient<ExtDefault, ExtDefault, StepExt> {
    addWorkflow(
      _workflow: Workflow<any, any, ExtDefault, ExtDefault, StepExt>
    ): void {
      return;
    }
    sendSignal(_opts: SendSignalOpts): Promise<{ runId: string | null }> {
      throw new Error("not implemented");
    }
    startWorkflow<TInput extends InputDefault>(
      _workflow: Workflow<TInput, any, ExtDefault, ExtDefault, StepExt>,
      _input: TInput
    ): Promise<StartData> {
      throw new Error("not implemented");
    }
  }

  class ExecutionDriver extends BaseExecutionDriver<
    ExtDefault,
    ExtDefault,
    StepExt
  > {
    async getStep(reportOp: ReportOp): Promise<Step<StepExt>> {
      return {
        ...createStdStep(reportOp),
        ext: {
          multiply: async (
            stepId: string,
            a: number,
            b: number
          ): Promise<number> => {
            return await createOpFound(
              reportOp,
              stepId,
              { code: "step.multiply", mode: OpMode.immediate },
              () => multiply(a, b)
            );
          },
        },
      };
    }
  }

  const driver = new ExecutionDriver(new StateDriver());
  const client = new MyClient();

  let result: number;
  const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
    counters.workflowTop++;
    result = await step.ext.multiply("foo", 2, 3);
    counters.workflowBottom++;
    return result;
  });
  const ops = await driver.execute({ ctx, workflow });
  expect(counters).toEqual({
    workflowTop: 1,
    multiply: 1,
    workflowBottom: 0,
  });
  expect(ops).toEqual([
    {
      config: {
        code: "step.multiply",
        mode: OpMode.immediate,
      },
      opId: {
        hashed: "187c5953271798be6a3b9c99a4ddf69f3ac19889",
        id: "foo",
        index: 0,
      },
      result: {
        output: 6,
        status: "success",
      },
      runId: "test-run-id",
      workflowId: "workflow",
    } satisfies OpResult,
  ]);
});

describe.only.concurrent("insideStep", () => {
  it("basic", async () => {
    expect(insideStep.get()).toBeUndefined();

    await insideStep.run("a", async () => {
      await insideStep.run("b", async () => {
        // Value is always the parent
        expect(insideStep.get()).toBe("b");
      });
      expect(insideStep.get()).toBe("a");
    });

    expect(insideStep.get()).toBeUndefined();
  });

  it("in parallel", async () => {
    // Works with a bunch in parallel

    expect(insideStep.get()).toBeUndefined();

    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(
        insideStep.run(`${i}`, async () => {
          expect(insideStep.get()).toBe(`${i}`);
          await new Promise((resolve) => setTimeout(resolve, 100));
          expect(insideStep.get()).toBe(`${i}`);
        })
      );
    }

    await Promise.all(promises);
    expect(insideStep.get()).toBeUndefined();
  });
});
