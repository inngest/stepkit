import { describe, expect, it } from "vitest";

import { StepKitClient } from "@stepkit/core";

import { InngestDriver } from "./driver";

describe("InngestDriver", () => {
  //
  // current inngest driver implementation passes through to inngest
  it("not implemented", async () => {
    const client = new StepKitClient({
      driver: new InngestDriver(),
      id: "my-app",
    });

    const workflow = client.workflow({ id: "workflow" }, async (ctx, step) => {
      const greeting = await step.run("get-greeting", async () => {
        return "Hello";
      });

      const name = await step.run("get-name", async () => {
        return ctx.input.name;
      });

      return `${greeting}, ${name}!`;
    });

    await expect(workflow.invoke({ name: "Alice" })).rejects.toThrow(
      "not implemented"
    );
  });
});
