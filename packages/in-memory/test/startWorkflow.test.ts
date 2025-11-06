import { afterEach, describe, expect, it, vi } from "vitest";

import { InMemoryClient } from "../src/main";

describe("startWorkflow", () => {
  it("success", async () => {
    const client = new InMemoryClient();
    client.start();

    afterEach(() => {
      client.stop();
    });

    const counters = {
      top: 0,
      getGreeting: 0,
      getName: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async (ctx, step) => {
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

    await workflow.start({ msg: "hi" });
    await vi.waitFor(() => {
      expect(counters).toEqual({
        top: 3,
        getGreeting: 1,
        getName: 1,
        bottom: 1,
      });
    });
  });
});
