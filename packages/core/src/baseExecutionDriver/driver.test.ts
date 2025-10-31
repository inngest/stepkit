import { describe, it, expect } from "vitest";
import { BaseExecutionDriver, OWClient } from "../main";
import { OpResult } from "../types";

class RunState {
  private ops: Map<string, OpResult>;
  constructor() {
    this.ops = new Map();
  }

  getOp(opId: string): OpResult | undefined {
    if (this.ops.has(opId)) {
      return this.ops.get(opId);
    }
    return undefined;
  }
  setOp(opId: string, op: OpResult): void {
    this.ops.set(opId, op);
  }
}

describe("execute", () => {
  it("no steps success", async () => {
    // When no steps, interrupt with workflow result

    const state = new RunState();
    const driver = new BaseExecutionDriver();
    const client = new OWClient({ driver });

    let counter = 0;
    const workflow = client.workflow({ id: "workflow" }, async ({ step }) => {
      counter++;
      return "Hello, Alice!";
    });

    const output = await driver.execute(state, workflow);
    expect(counter).toBe(1);
    expect(output).toEqual([
      {
        config: { code: "workflow.success" },
        id: {
          hashed: "",
          id: "",
          index: 0,
        },
        result: {
          status: "success",
          output: "Hello, Alice!",
        },
      },
    ]);
  });

  it("no steps error", async () => {
    // When no steps, interrupt with workflow result

    const state = new RunState();
    const driver = new BaseExecutionDriver();
    const client = new OWClient({ driver });

    let counter = 0;
    const workflow = client.workflow({ id: "workflow" }, async ({ step }) => {
      counter++;
      throw new Error("oh no");
    });

    const output = await driver.execute(state, workflow);
    expect(counter).toBe(1);
    expect(output).toEqual([
      {
        config: { code: "workflow.error" },
        id: {
          hashed: "",
          id: "",
          index: 0,
        },
        result: {
          status: "error",
          error: expect.any(Error),
        },
      },
    ]);
  });

  it("step.run success", async () => {
    // When successfully running a step, interrupt with step result

    const state = new RunState();
    const driver = new BaseExecutionDriver();
    const client = new OWClient({ driver });

    const counters = {
      top: 0,
      getName: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async ({ step }) => {
      counters.top++;
      const name = await step.run("get-name", async () => {
        counters.getName++;
        return "Alice";
      });
      counters.bottom++;
      return `Hello, ${name}!`;
    });

    const result = await driver.execute(state, workflow);
    expect(counters).toEqual({
      top: 1,
      getName: 1,
      bottom: 0,
    });
    expect(result).toEqual([
      {
        config: { code: "step.run.success" },
        id: {
          hashed: "get-name",
          id: "get-name",
          index: 0,
        },
        result: {
          status: "success",
          output: "Alice",
        },
      },
    ]);
  });

  it("step.run error", async () => {
    // When successfully running a step, interrupt with step result

    const state = new RunState();
    const driver = new BaseExecutionDriver();
    const client = new OWClient({ driver });

    const counters = {
      top: 0,
      getName: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async ({ step }) => {
      counters.top++;
      const name = await step.run("get-name", async () => {
        counters.getName++;
        throw new Error("oh no");
      });
      counters.bottom++;
      return `Hello, ${name}!`;
    });

    const result = await driver.execute(state, workflow);
    expect(counters).toEqual({
      top: 1,
      getName: 1,
      bottom: 0,
    });
    expect(result).toEqual([
      {
        config: { code: "step.run.error" },
        id: {
          hashed: "get-name",
          id: "get-name",
          index: 0,
        },
        result: {
          status: "error",
          error: expect.any(Error),
        },
      },
    ]);
  });

  it("step.sleep", async () => {
    // When successfully running a step, interrupt with step result

    const state = new RunState();
    const driver = new BaseExecutionDriver();
    const client = new OWClient({ driver });

    const counters = {
      top: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async ({ step }) => {
      counters.top++;
      await step.sleep("zzz", 1000);
      counters.bottom++;
      return "Hello";
    });

    const start = Date.now();
    const result = await driver.execute(state, workflow);

    // Did not actually sleep since we only reported it
    expect(Date.now() - start).toBeLessThan(100);

    expect(counters).toEqual({
      top: 1,
      bottom: 0,
    });
    expect(result).toEqual([
      {
        config: { code: "step.sleep" },
        id: {
          hashed: "zzz",
          id: "zzz",
          index: 0,
        },
        result: {
          status: "success",
          output: undefined,
        },
      },
    ]);
  });
});
