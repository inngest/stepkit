import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { eventTrigger } from "@stepkit/core";

import { InMemoryClient } from "../src/main";

describe("trigger validation", () => {
  it.concurrent("validates input from trigger schema", async () => {
    const client = new InMemoryClient();
    client.start();
    afterEach(() => client.stop());

    //
    // Define workflow with trigger that includes schema
    const workflow = client.workflow(
      {
        id: "workflow-with-trigger",
        triggers: [
          eventTrigger("test.event", z.object({ userId: z.number() })),
        ],
      },
      async (ctx, _step) => {
        return ctx.input.data.userId;
      }
    );

    //
    // Valid input should work
    const result = await client.invoke(workflow, { userId: 123 });
    expect(result).toBe(123);
  });

  it.concurrent("rejects invalid input from trigger schema", async () => {
    const client = new InMemoryClient();
    client.start();
    afterEach(() => client.stop());

    //
    // Define workflow with trigger that includes schema
    const workflow = client.workflow(
      {
        id: "workflow-with-validation",
        triggers: [
          eventTrigger("test.event", z.object({ userId: z.number() })),
        ],
      },
      async (ctx, _step) => {
        return ctx.input.data.userId;
      }
    );

    //
    // Invalid input should fail at runtime
    let error: unknown;
    try {
      await client.invoke(workflow, { userId: "not-a-number" } as any);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(Error);
    const err = error as Error;
    expect(err.name).toBe("InvalidInputError");
  });

  it.concurrent("validates union of multiple trigger schemas", async () => {
    const client = new InMemoryClient();
    client.start();
    afterEach(() => client.stop());

    //
    // Define workflow with multiple triggers with different schemas
    const workflow = client.workflow(
      {
        id: "workflow-with-multiple-triggers",
        triggers: [
          eventTrigger("user.created", z.object({ userId: z.number() })),
          eventTrigger(
            "user.updated",
            z.object({ userId: z.number(), name: z.string() })
          ),
        ],
      },
      async (ctx, _step) => {
        return ctx.input.data.userId;
      }
    );

    //
    // First schema shape should work
    const result1 = await client.invoke(workflow, { userId: 123 });
    expect(result1).toBe(123);

    //
    // Second schema shape should work
    const result2 = await client.invoke(workflow, {
      userId: 456,
      name: "Alice",
    });
    expect(result2).toBe(456);

    //
    // Invalid input (matches neither schema) should fail at runtime
    let error: unknown;
    try {
      await client.invoke(workflow, { userId: "not-a-number" } as any);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(Error);
    const err = error as Error;
    expect(err.name).toBe("InvalidInputError");
  });
});
