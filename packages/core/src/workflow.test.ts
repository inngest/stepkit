import type { StandardSchemaV1 } from "@standard-schema/spec";
import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";

import {
  staticSchema,
  type Context,
  type ExtDefault,
  type InputDefault,
  type Step,
} from "./types";
import {
  Workflow,
  type Client,
  type StartData,
  type Trigger,
} from "./workflow";

class NoopClient<
  TWorkflowCfgExt extends ExtDefault,
  TCtxExt extends ExtDefault,
  TStepExt extends ExtDefault,
> implements Client<TWorkflowCfgExt, TCtxExt, TStepExt>
{
  workflow<TInput extends InputDefault = InputDefault, TOutput = unknown>(
    opts: {
      ext?: TWorkflowCfgExt;
      id: string;
      inputSchema?: StandardSchemaV1<TInput>;
      maxAttempts?: number;
      triggers?: Trigger[];
    },
    handler: (
      ctx: Context<TInput, TCtxExt>,
      step: Step<TStepExt>
    ) => Promise<TOutput>
  ): Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt> {
    return new Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt>({
      ...opts,
      client: this,
      handler,
    });
  }

  startWorkflow<TInput extends InputDefault>(
    _workflow: Workflow<TInput, any, TWorkflowCfgExt, TCtxExt, TStepExt>,
    _input: TInput
  ): Promise<StartData> {
    throw new Error("not implemented");
  }
}

describe("input type", () => {
  // Doesn't matter for these tests

  // eslint-disable-next-line vitest/expect-expect
  it("default type", () => {
    class MyClient extends NoopClient<ExtDefault, ExtDefault, ExtDefault> {}
    const client = new MyClient();

    client.workflow({ id: "workflow" }, async (ctx) => {
      expectTypeOf(ctx.input).toEqualTypeOf<{
        data: Record<string, unknown>;
        ext: ExtDefault;
        id: string;
        name: string;
        time: Date;
        type: "cron" | "event" | "invoke";
      }>();
    });
  });

  // eslint-disable-next-line vitest/expect-expect
  it("static type only", () => {
    class MyClient extends NoopClient<ExtDefault, ExtDefault, ExtDefault> {}
    const client = new MyClient();
    type Input = { name: string };

    client.workflow(
      { id: "workflow", inputSchema: staticSchema<Input>() },
      async (ctx) => {
        expectTypeOf(ctx.input).toEqualTypeOf<{
          data: Input;
          ext: ExtDefault;
          id: string;
          name: string;
          time: Date;
          type: "cron" | "event" | "invoke";
        }>();
      }
    );
  });

  // eslint-disable-next-line vitest/expect-expect
  it("zod type", () => {
    class MyClient extends NoopClient<ExtDefault, ExtDefault, ExtDefault> {}
    const client = new MyClient();
    const inputSchema = z.object({ name: z.string() });

    client.workflow({ id: "workflow", inputSchema }, async (ctx) => {
      expectTypeOf(ctx.input).toEqualTypeOf<{
        data: { name: string };
        ext: ExtDefault;
        id: string;
        name: string;
        time: Date;
        type: "cron" | "event" | "invoke";
      }>();
    });
  });
});

describe("custom workflow config field", () => {
  // eslint-disable-next-line vitest/expect-expect
  it("default type", () => {
    type WorkflowConfigExt = {
      concurrency: {
        key?: string;
        limit: number;
      };
    };

    class MyClient extends NoopClient<
      WorkflowConfigExt,
      ExtDefault,
      ExtDefault
    > {}
    const client = new MyClient();

    // Invalid
    client.workflow(
      {
        id: "workflow",
        ext: {
          concurrency: {
            limit: 1,

            // @ts-expect-error - This should be an error
            key: 2,
          },
        },
      },
      async (_) => {
        return null;
      }
    );
  });
});

// eslint-disable-next-line vitest/expect-expect
it("custom ctx field", () => {
  type CtxExt = {
    foo: string;
  };

  class MyClient extends NoopClient<ExtDefault, CtxExt, ExtDefault> {}
  const client = new MyClient();

  client.workflow({ id: "workflow" }, async (ctx) => {
    expectTypeOf(ctx.ext.foo).toEqualTypeOf<string>();
  });
});

// eslint-disable-next-line vitest/expect-expect
it("custom step method", () => {
  type StepExt = {
    foo: (stepId: string) => Promise<string>;
  };

  class MyClient extends NoopClient<ExtDefault, ExtDefault, StepExt> {}
  const client = new MyClient();

  client.workflow({ id: "workflow" }, async (_, step) => {
    expectTypeOf(step.ext.foo).toEqualTypeOf<
      (stepId: string) => Promise<string>
    >();
  });
});
