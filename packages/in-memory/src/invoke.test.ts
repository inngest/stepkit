import { describe, it, expect } from "vitest";
import { OWClient } from "@stepkit/core";
import { InMemoryDriver } from "./drivers";

describe("Orchestrator", () => {
  it.only("invoke success", async () => {
    // Keep looping through interrupts until the run completes

    const client = new OWClient({ driver: new InMemoryDriver() });

    const counters = {
      top: 0,
      getGreeting: 0,
      getName: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async ({ step }) => {
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

    const output = await workflow.invoke({});

    expect(counters).toEqual({
      top: 3,
      getGreeting: 1,
      getName: 1,
      bottom: 1,
    });
    expect(output).toEqual("Hello, Alice!");
  });
});
