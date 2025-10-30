import { describe, it, expect } from "vitest";
import { BaseExeDriver, greeting, OWClient, StepStateItem } from "./main";
import { executionLoop } from "./executionLoop";

class RunState {
  private steps: Map<string, StepStateItem>;
  constructor() {
    this.steps = new Map();
  }

  getStep(id: string): StepStateItem | undefined {
    if (this.steps.has(id)) {
      return this.steps.get(id);
    }
    return undefined;
  }
  setStep(id: string, state: StepStateItem): void {
    // console.log("setStep", id, state);
    this.steps.set(id, state);
  }
}

describe("executionLoop", () => {
  it("no steps success", async () => {
    // When no steps, interrupt with workflow result

    const client = new OWClient({ driver: new BaseExeDriver(new RunState()) });

    let counter = 0;
    const workflow = client.workflow({ id: "workflow" }, async ({ step }) => {
      counter++;
      return "Hello, Alice!";
    });

    const output = await workflow.invoke({});

    expect(counter).toBe(1);
    expect(output).toEqual([
      {
        hashedId: "",
        id: "",
        idIndex: 0,
        op: {
          code: "workflow.success",
          opts: {
            output: "Hello, Alice!",
          },
        },
      },
    ]);
  });

  it("no steps error", async () => {
    // When no steps, interrupt with workflow result

    const driver = new BaseExeDriver(new RunState());
    const client = new OWClient({ driver });

    let counter = 0;
    const workflow = client.workflow({ id: "workflow" }, async ({ step }) => {
      counter++;
      throw new Error("oh no");
    });

    const output = await executionLoop({
      workflow,
      state: new RunState(),
      onStepsFound: driver.onStepsFound,
    });

    expect(counter).toBe(1);
    expect(output).toEqual([
      {
        hashedId: "",
        id: "",
        idIndex: 0,
        op: {
          code: "workflow.error",
          opts: {
            error: expect.any(Error),
          },
        },
      },
    ]);
  });

  it("step success", async () => {
    // When successfully running a step, interrupt with step result

    const driver = new BaseExeDriver(new RunState());
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

    const result = await executionLoop({
      workflow,
      state: new RunState(),
      onStepsFound: driver.onStepsFound,
    });
    expect(counters).toEqual({
      top: 1,
      getName: 1,
      bottom: 0,
    });
    expect(result).toEqual([
      {
        hashedId: "get-name",
        id: "get-name",
        idIndex: 0,
        op: {
          code: "step.run.success",
          opts: {
            output: "Alice",
          },
        },
      },
    ]);
  });

  it("step error", async () => {
    // When successfully running a step, interrupt with step result

    const driver = new BaseExeDriver(new RunState());
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

    const result = await executionLoop({
      workflow,
      state: new RunState(),
      onStepsFound: driver.onStepsFound,
    });
    expect(counters).toEqual({
      top: 1,
      getName: 1,
      bottom: 0,
    });
    expect(result).toEqual([
      {
        hashedId: "get-name",
        id: "get-name",
        idIndex: 0,
        op: {
          code: "step.run.error",
          opts: {
            error: expect.any(Error),
          },
        },
      },
    ]);
  });
});
