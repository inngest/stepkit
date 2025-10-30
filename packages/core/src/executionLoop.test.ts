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
  it("1 step", async () => {
    const client = new OWClient({ driver: new BaseExeDriver(new RunState()) });

    let getNameCounter = 0;
    const workflow = client.workflow({ id: "workflow" }, async ({ step }) => {
      const name = await step.run("get-name", async () => {
        getNameCounter++;
        return "Alice";
      });
      console.log("name", name);

      return `Hello, ${name}!`;
    });

    const output = await workflow.invoke({});

    expect(getNameCounter).toBe(1);
    expect(output).toBe("Hello, Alice!");
  });

  it.only("2 steps", async () => {
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
