import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BaseClient } from "@stepkit/sdk-tools";

import { sleep } from "../../src/common/utils";
import { expectError } from "../utils";

export function stepInvokeWorkflowSuite<TClient extends BaseClient>(
  createClient: () => TClient | Promise<TClient>,
  cleanup: (client: TClient) => void | Promise<void>
): void {
  interface TestContext {
    client: TClient;
  }

  describe.concurrent("step.invokeWorkflow", () => {
    beforeEach<TestContext>(async (ctx) => {
      ctx.client = await createClient();
    });
    afterEach<TestContext>(async ({ client }) => {
      await cleanup(client);
    });

    it<TestContext>("success", async ({ client }) => {
      try {
        const counters = {
          child: {
            top: 0,
            bottom: 0,
          },
          parent: {
            top: 0,
            delayStep: 0,
            bottom: 0,
          },
        };
        let childOutput = "";
        const workflowParent = client.workflow(
          { id: "workflow" },
          async (ctx, step) => {
            counters.parent.top++;
            childOutput = await step.invokeWorkflow("invoke", {
              timeout: 2000,
              workflow: workflowChild,
            });

            await step.run("delay", async () => {
              counters.parent.delayStep++;

              // Wait past the previous `invokeWorkflow`'s timeout. This ensures
              // we properly skip the timeout job
              await sleep(3000);
            });

            counters.parent.bottom++;
          }
        );
        const workflowChild = client.workflow(
          { id: "workflow-child" },
          async (ctx, step) => {
            counters.child.top++;
            const output = await step.run("a", () => "Hello");
            counters.child.bottom++;
            return output;
          }
        );

        await workflowParent.start({ msg: "hi" });
        await vi.waitFor(() => {
          expect(counters).toEqual({
            child: {
              top: 2,
              bottom: 1,
            },
            parent: {
              top: 3,
              delayStep: 1,
              bottom: 1,
            },
          });
        }, 4000);
        expect(childOutput).toEqual("Hello");
      } finally {
        await cleanup(client);
      }
    });

    it<TestContext>("error", async ({ client }) => {
      class MyError extends Error {
        constructor(message: string) {
          super(message);
          this.name = this.constructor.name;
        }
      }

      const counters = {
        child: {
          top: 0,
          bottom: 0,
        },
        parent: {
          top: 0,
          bottom: 0,
        },
      };
      let error: unknown;
      const workflowParent = client.workflow(
        { id: "workflow" },
        async (ctx, step) => {
          counters.parent.top++;
          try {
            await step.invokeWorkflow("invoke", {
              timeout: 2000,
              workflow: workflowChild,
            });
          } catch (e) {
            error = e;
            throw e;
          }
          counters.parent.bottom++;
        }
      );
      const workflowChild = client.workflow(
        { id: "workflow-child" },
        async () => {
          counters.child.top++;
          throw new MyError("oh no");
        }
      );

      await workflowParent.start({ msg: "hi" });
      await vi.waitFor(() => {
        expect(counters).toEqual({
          child: {
            top: 4,
            bottom: 0,
          },
          parent: {
            // No retries
            top: 2,

            bottom: 0,
          },
        });
        expect(error).toBeDefined();
      });
      expectError(error, {
        message: "oh no",
        name: "MyError",
      });
    });

    it<TestContext>("timeout", async ({ client }) => {
      const counters = {
        child: {
          top: 0,
          bottom: 0,
        },
        parent: {
          top: 0,
          bottom: 0,
        },
      };
      let childRunId = "";
      let error: unknown;
      const workflowParent = client.workflow(
        { id: "parent" },
        async (ctx, step) => {
          counters.parent.top++;
          try {
            await step.invokeWorkflow("invoke", {
              timeout: 1000,
              workflow: workflowChild,
            });
          } catch (e) {
            error = e;
            throw e;
          }
          counters.parent.bottom++;
        }
      );
      const workflowChild = client.workflow({ id: "child" }, async (ctx) => {
        childRunId = ctx.runId;
        counters.child.top++;
        await sleep(2000);
        counters.child.bottom++;
      });

      await workflowParent.start({ msg: "hi" });
      await vi.waitFor(() => {
        expect(counters).toEqual({
          child: {
            top: 1,
            bottom: 1,
          },
          parent: {
            top: 2,
            bottom: 0,
          },
        });
      }, 3000);
      expectError(error, {
        message: `invoked run ${childRunId} timed out`,
        name: "InvokeTimeoutError",
      });
    });
  });
}
