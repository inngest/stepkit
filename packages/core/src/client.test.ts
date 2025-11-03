import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";

import { StepKitClient } from "./client";
import type { StdContext } from "./implementer";
import type { Pretty } from "./types";

describe("input type", () => {
  // Doesn't matter for these tests
  const driver = null as any;

  // eslint-disable-next-line vitest/expect-expect
  it("default type", () => {
    const client = new StepKitClient({ driver });

    client.workflow({ id: "workflow" }, async (ctx) => {
      expectTypeOf(ctx).toEqualTypeOf<StdContext>();
      expectTypeOf(ctx.input).toEqualTypeOf<Record<string, unknown>[]>();
    });
  });

  // eslint-disable-next-line vitest/expect-expect
  it("static type only", () => {
    const client = new StepKitClient({ driver });
    type Input = { name: string };

    client.workflow<Input>({ id: "workflow" }, async (ctx) => {
      expectTypeOf(ctx).toEqualTypeOf<StdContext<Input>>();
      expectTypeOf(ctx.input).toEqualTypeOf<Input[]>();
    });
  });

  // eslint-disable-next-line vitest/expect-expect
  it("zod type", () => {
    const client = new StepKitClient({ driver });
    const schema = z.object({ name: z.string() });

    client.workflow({ id: "workflow", schema }, async (ctx) => {
      expectTypeOf(ctx).toEqualTypeOf<StdContext<{ name: string }>>();
      expectTypeOf(ctx.input).toEqualTypeOf<{ name: string }[]>();
    });
  });
});

describe("custom ctx field", () => {
  // Doesn't matter for these tests
  const driver = null as any;

  // eslint-disable-next-line vitest/expect-expect
  it("default type", () => {
    type Context<
      TInput extends Record<string, unknown> = Record<string, unknown>,
    > = Pretty<
      StdContext<TInput> & {
        foo: string;
      }
    >;

    const client = new StepKitClient<Context<any>>({ driver });

    client.workflow<{ name: string }>({ id: "workflow" }, async (ctx) => {
      expectTypeOf(ctx).toEqualTypeOf<Context<{ name: string }>>();
      expectTypeOf(ctx.input).toEqualTypeOf<{ name: string }[]>();
    });
  });
});
