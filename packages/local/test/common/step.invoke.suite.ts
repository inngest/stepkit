import { describe, expect, it, vi } from "vitest";

import type { BaseClient } from "@stepkit/sdk-tools";

import { sleep } from "../../src/common/utils";
import { expectError } from "../utils";

export function stepInvokeWorkflowSuite<TClient extends BaseClient>(
  createClient: () => TClient | Promise<TClient>,
  cleanup: (client: TClient) => void | Promise<void>
): void {
  describe("step.invokeWorkflow", () => {
    it("success", async () => {
      const client = await createClient();
      try {
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
        let childOutput = "";
        const workflowParent = client.workflow(
          { id: "workflow" },
          async (ctx, step) => {
            counters.parent.top++;
            childOutput = await step.invokeWorkflow("workflow-child", {
              timeout: 2000,
              workflow: workflowChild,
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
              top: 2,
              bottom: 1,
            },
          });
        });
        expect(childOutput).toEqual("Hello");
      } finally {
        await cleanup(client);
      }
    });

    it("error", async () => {
      const client = await createClient();
      try {
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
              await step.invokeWorkflow("workflow-child", {
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
      } finally {
        await cleanup(client);
      }
    });

    it("timeout", async () => {
      const client = await createClient();
      try {
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
              await step.invokeWorkflow("a", {
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
      } finally {
        await cleanup(client);
      }
    });
  });
}
