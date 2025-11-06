import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";

import { StepKitClient } from "./client";
import { type ExecutionDriver } from "./executionDriver";
import { staticSchema, type ExtDefault, type InputDefault } from "./types";
import { type StartData, type Workflow } from "./workflow";

describe("input type", () => {
  // Doesn't matter for these tests
  class MyExecutionDriver implements ExecutionDriver {
    addWorkflow(_workflow: Workflow): void {
      return;
    }
    startWorkflow<TInput extends InputDefault>(
      _workflow: Workflow<TInput, any>,
      _input: TInput
    ): Promise<StartData> {
      throw new Error("not implemented");
    }
  }

  const driver = new MyExecutionDriver();

  // eslint-disable-next-line vitest/expect-expect
  it("default type", () => {
    const client = new StepKitClient({ driver, id: "my-app" });

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
    const client = new StepKitClient({ driver, id: "my-app" });
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
    const client = new StepKitClient({ driver, id: "my-app" });
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

    class MyExecutionDriver implements ExecutionDriver<WorkflowConfigExt> {
      addWorkflow(_workflow: Workflow<any, any, WorkflowConfigExt>): void {
        return;
      }
      startWorkflow<TInput extends InputDefault>(
        _workflow: Workflow<TInput, any, WorkflowConfigExt>,
        _input: TInput
      ): Promise<StartData> {
        throw new Error("not implemented");
      }
    }

    const client = new StepKitClient({
      driver: new MyExecutionDriver(),
      id: "my-app",
    });

    // Valid
    client.workflow(
      { id: "workflow", ext: { concurrency: { limit: 1 } } },
      async (_) => {
        return null;
      }
    );

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

  class MyExecutionDriver implements ExecutionDriver<ExtDefault, CtxExt> {
    addWorkflow(_workflow: Workflow<any, any, ExtDefault, CtxExt>): void {
      return;
    }
    startWorkflow<TInput extends InputDefault>(
      _workflow: Workflow<TInput, any, ExtDefault, CtxExt>,
      _input: TInput
    ): Promise<StartData> {
      throw new Error("not implemented");
    }
  }

  const client = new StepKitClient({
    driver: new MyExecutionDriver(),
    id: "my-app",
  });

  client.workflow({ id: "workflow" }, async (ctx) => {
    expectTypeOf(ctx.ext.foo).toEqualTypeOf<string>();
  });
});

// eslint-disable-next-line vitest/expect-expect
it("custom step method", () => {
  type StepExt = {
    foo: (stepId: string) => Promise<string>;
  };

  class MyExecutionDriver
    implements ExecutionDriver<ExtDefault, ExtDefault, StepExt>
  {
    addWorkflow(
      _workflow: Workflow<any, any, ExtDefault, ExtDefault, StepExt>
    ): void {
      return;
    }
    startWorkflow<TInput extends InputDefault>(
      _workflow: Workflow<TInput, any, ExtDefault, ExtDefault, StepExt>
    ): Promise<StartData> {
      throw new Error("not implemented");
    }
  }

  const client = new StepKitClient<ExtDefault, ExtDefault, StepExt>({
    driver: new MyExecutionDriver(),
    id: "my-app",
  });

  client.workflow({ id: "workflow" }, async (_, step) => {
    expectTypeOf(step.ext.foo).toEqualTypeOf<
      (stepId: string) => Promise<string>
    >();
  });
});
