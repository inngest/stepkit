import { describe, it, expect } from "vitest";
import { BaseExeDriver, greeting, OWClient, StepStateItem } from "./main";

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
    console.log("setStep", id, state);
    this.steps.set(id, state);
  }
}

describe("executionLoop", () => {
  it("no steps", async () => {
    const client = new OWClient({ driver: new BaseExeDriver(new RunState()) });

    let counter = 0;
    const workflow = client.workflow({ id: "workflow" }, async ({ step }) => {
      counter++;
      return "Hello, Alice!";
    });

    const output = await workflow.invoke({});

    expect(counter).toBe(1);
    expect(output).toBe("Hello, Alice!");
  });

  it.only("1 step", async () => {
    const client = new OWClient({ driver: new BaseExeDriver(new RunState()) });

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

    const output = await workflow.invoke({});

    expect(counters).toEqual({
      top: 2,
      getName: 1,
      bottom: 1,
    });
    expect(output).toBe("Hello, Alice!");
  });

  it("2 steps", async () => {
    const client = new OWClient({ driver: new BaseExeDriver(new RunState()) });

    let getGreetingCounter = 0;
    let getNameCounter = 0;
    const workflow = client.workflow({ id: "workflow" }, async ({ step }) => {
      const greeting = await step.run("get-greeting", async () => {
        getGreetingCounter++;
        return "Hello";
      });

      const name = await step.run("get-name", async () => {
        getNameCounter++;
        return "Alice";
      });
      console.log("name", name);

      return `${greeting}, ${name}!`;
    });

    const output = await workflow.invoke({});

    expect(getGreetingCounter).toBe(1);
    expect(getNameCounter).toBe(1);
    expect(output).toBe("Hello, Alice!");
  });
});
