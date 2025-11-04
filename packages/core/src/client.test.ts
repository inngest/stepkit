import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";

import { StepKitClient } from "./client";
import { BaseExecutionDriver, createStdStep } from "./executionDriver";
import { type ReportOp } from "./findOps";
import {
  staticSchema,
  type ExtDefault,
  type OpResult,
  type Step,
} from "./types";
import { stdHashId } from "./utils";

class DummyStateDriver {
  getOp(_id: { runId: string; hashedOpId: string }): OpResult | undefined {
    throw new Error("not implemented");
  }
  setOp(_id: { runId: string; hashedOpId: string }, _op: OpResult): void {
    throw new Error("not implemented");
  }
}

describe("input type", () => {
  // Doesn't matter for these tests
  class ExecutionDriver extends BaseExecutionDriver {
    constructor() {
      super(new DummyStateDriver());
    }

    async getStep(reportOp: ReportOp): Promise<Step> {
      return createStdStep(stdHashId, reportOp);
    }
  }

  const driver = new ExecutionDriver();

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

describe("custom workflow config field", () => {
  // eslint-disable-next-line vitest/expect-expect
  it("default type", () => {
    type WorkflowConfigExt = {
      concurrency: {
        key?: string;
        limit: number;
      };
    };

    class ExecutionDriver extends BaseExecutionDriver<WorkflowConfigExt> {
      constructor() {
        super(new DummyStateDriver());
      }

      async getStep(reportOp: ReportOp): Promise<Step> {
        return createStdStep(stdHashId, reportOp);
      }
    }

    const client = new StepKitClient({ driver: new ExecutionDriver() });

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

  class ExecutionDriver extends BaseExecutionDriver<ExtDefault, CtxExt> {
    constructor() {
      super(new DummyStateDriver());
    }

    async getStep(reportOp: ReportOp): Promise<Step> {
      return createStdStep(stdHashId, reportOp);
    }
  }

  const client = new StepKitClient({ driver: new ExecutionDriver() });

  client.workflow({ id: "workflow" }, async (ctx) => {
    expectTypeOf(ctx.ext.foo).toEqualTypeOf<string>();
  });
});

// eslint-disable-next-line vitest/expect-expect
it("custom step method", () => {
  type StepExt = {
    foo: (stepId: string) => Promise<string>;
  };

  class ExecutionDriver extends BaseExecutionDriver<
    ExtDefault,
    ExtDefault,
    StepExt
  > {
    constructor() {
      super(new DummyStateDriver());
    }

    async getStep(reportOp: ReportOp): Promise<Step<StepExt>> {
      return {
        ...createStdStep(stdHashId, reportOp),
        ext: {
          foo: async () => {
            return "foo";
          },
        },
      };
    }
  }

  const client = new StepKitClient<ExtDefault, ExtDefault, StepExt>({
    driver: new ExecutionDriver(),
  });

  client.workflow({ id: "workflow" }, async (_, step) => {
    expectTypeOf(step.ext.foo).toEqualTypeOf<
      (stepId: string) => Promise<string>
    >();
  });
});
