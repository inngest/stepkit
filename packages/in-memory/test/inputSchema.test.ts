import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { eventTrigger } from "@stepkit/core";

import { InMemoryClient } from "../src/main";

describe("inputSchema", () => {
  it.concurrent("validates input from explicit inputSchema", async () => {
    const client = new InMemoryClient();
    client.start();
    afterEach(() => client.stop());

    //
    // Define workflow with explicit inputSchema (for invoke-only workflows)
    const workflow = client.workflow(
      {
        id: "workflow-with-inputSchema",
        inputSchema: z.object({ name: z.string() }),
      },
      async (ctx, _step) => {
        return ctx.input.data.name;
      }
    );

    //
    // Valid input should work
    const result = await client.invoke(workflow, { name: "Alice" });
    expect(result).toBe("Alice");
  });

  it.concurrent("rejects invalid input from explicit inputSchema", async () => {
    const client = new InMemoryClient();
    client.start();
    afterEach(() => client.stop());

    //
    // Define workflow with explicit inputSchema
    const workflow = client.workflow(
      {
        id: "workflow-with-validation",
        inputSchema: z.object({ name: z.string() }),
      },
      async (ctx, _step) => {
        return ctx.input.data.name;
      }
    );

    //
    // Invalid input should fail at runtime
    let error: unknown;
    try {
      await client.invoke(workflow, { name: 123 } as any);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(Error);
    const err = error as Error;
    expect(err.name).toBe("InvalidInputError");
  });

  it.concurrent("explicit inputSchema takes precedence over trigger schemas", async () => {
    const client = new InMemoryClient();
    client.start();
    afterEach(() => client.stop());

    //
    // Define workflow with both inputSchema and trigger
    // inputSchema should take precedence
    const workflow = client.workflow(
      {
        id: "workflow-with-both",
        inputSchema: z.object({ name: z.string() }),
        triggers: [
          eventTrigger("test.event", z.object({ userId: z.number() })),
        ],
      },
      async (ctx, _step) => {
        return ctx.input.data;
      }
    );

    //
    // inputSchema validation should apply
    const result = await client.invoke(workflow, { name: "Alice" });
    expect(result).toEqual({ name: "Alice" });

    //
    // Trigger schema should NOT apply (inputSchema takes precedence)
    let error: unknown;
    try {
      await client.invoke(workflow, { userId: 123 } as any);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(Error);
    const err = error as Error;
    expect(err.name).toBe("InvalidInputError");
  });
});
