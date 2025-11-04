import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";

import { StepKitClient } from "./client";
import { staticSchema } from "./types";

describe("input type", () => {
  // Doesn't matter for these tests
  const driver = null as any;

  // eslint-disable-next-line vitest/expect-expect
  it("default type", () => {
    const client = new StepKitClient({ driver });

    client.workflow({ id: "workflow" }, async (ctx) => {
      expectTypeOf(ctx.input).toEqualTypeOf<Record<string, unknown>>();
    });
  });

  // eslint-disable-next-line vitest/expect-expect
  it("static type only", () => {
    const client = new StepKitClient({ driver });
    type Input = { name: string };

    client.workflow(
      { id: "workflow", inputSchema: staticSchema<Input>() },
      async (ctx) => {
        expectTypeOf(ctx.input).toEqualTypeOf<Input>();
      }
    );
  });

  // eslint-disable-next-line vitest/expect-expect
  it("zod type", () => {
    const client = new StepKitClient({ driver });
    const inputSchema = z.object({ name: z.string() });

    client.workflow({ id: "workflow", inputSchema }, async (ctx) => {
      expectTypeOf(ctx.input).toEqualTypeOf<{ name: string }>();
    });
  });
});

describe("custom ctx field", () => {
  // Doesn't matter for these tests
  const driver = null as any;

  // eslint-disable-next-line vitest/expect-expect
  it("default type", () => {
    type CtxExt = {
      foo: string;
    };

    const client = new StepKitClient<CtxExt>({ driver });

    client.workflow({ id: "workflow" }, async (ctx) => {
      expectTypeOf(ctx.ext.foo).toEqualTypeOf<string>();
    });
  });
});
