import { describe, it, expect } from "vitest";
import { WorkflowClient } from "@open-workflow/core";
import { InMemoryDriver } from "../src/index.js";

describe("executionLoop", () => {
  it("no steps", async () => {
    const client = new WorkflowClient(new InMemoryDriver());

    let counter = 0;
    const workflow = client.workflow({ id: "workflow" }, async () => {
      counter++;
      return "Hello, Alice!";
    });

    const output = await workflow.invoke({});

    expect(counter).toBe(1);
    expect(output).toBe("Hello, Alice!");
  });

  it.only("2 steps", async () => {
    const client = new WorkflowClient(new InMemoryDriver());

    const counters = {
      bottom: 0,
      getname: 0,
      getgreeting: 0,
      top: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async ({ step }) => {
      counters.top++;

      const greeting = await step.run("get-greeting", async () => {
        counters.getgreeting++;
        return "Hello";
      });

      const name = await step.run("get-name", async () => {
        counters.getname++;
        return "Alice";
      });

      counters.bottom++;
      return `${greeting}, ${name}!`;
    });

    const output = await workflow.invoke({});

    expect(counters).toEqual({
      bottom: 1,
      getname: 1,
      getgreeting: 1,
      top: 1,
    });
    expect(output).toBe("Hello, Alice!");
  });

  it("step retry", async () => {
    const client = new WorkflowClient(new InMemoryDriver());

    const counters = {
      bottom: 0,
      getname: 0,
      getgreeting: 0,
      top: 0,
    };
    const workflow = client.workflow(
      { id: "workflow" },
      async ({ attempt, step }) => {
        console.log("top", attempt);
        counters.top++;

        const greeting = await step.run("get-greeting", async () => {
          console.log("get-greeting", attempt);
          counters.getgreeting++;
          if (attempt === 0) {
            throw new Error("test");
          }
          return "Hello";
        });
        console.log("---");

        const name = await step.run("get-name", async () => {
          console.log("get-name");
          counters.getname++;
          return "Alice";
        });

        counters.bottom++;
        return `${greeting}, ${name}!`;
      },
    );

    const output = await workflow.invoke({});

    expect(counters).toEqual({
      bottom: 1,
      getname: 1,
      getgreeting: 2,
      top: 4,
    });
    expect(output).toBe("Hello, Alice!");
  });
});
