import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BaseClient } from "@stepkit/sdk-tools";

import { sleep } from "../../src/common/utils";

export function parallelStepSuite<TClient extends BaseClient>(
  createClient: () => TClient | Promise<TClient>,
  cleanup: (client: TClient) => void | Promise<void>
): void {
  interface TestContext {
    client: TClient;
  }

  describe.concurrent("parallel steps", () => {
    beforeEach<TestContext>(async (ctx) => {
      ctx.client = await createClient();
    });
    afterEach<TestContext>(async ({ client }) => {
      await cleanup(client);
    });

    it<TestContext>("multiple step.sleep", async ({ client }) => {
      const counters = {
        a: 0,
        p1: 0,
        p2: 0,
        b: 0,
      };
      const outputs: Record<string, unknown> = {
        a: undefined,
        parallel: undefined,
        b: undefined,
      };
      const workflow = client.workflow(
        { id: "workflow" },
        async (ctx, step) => {
          outputs.a = await step.run("a", async () => {
            counters.a++;
            return "A";
          });

          outputs.parallel = await Promise.all([
            step.run("p1", async () => {
              counters.p1++;
              return "P1";
            }),
            step.run("p2", async () => {
              counters.p2++;
              return "P2";
            }),
            step.sleep("p3", 1000),
            step.sleep("p4", 2000),
          ]);

          outputs.b = await step.run("b", async () => {
            // Sleep to give race conditions a chance to happen
            await sleep(1000);

            counters.b++;
            return "B";
          });
        }
      );

      const start = Date.now();
      await workflow.start({});

      await vi.waitFor(() => {
        expect(counters).toEqual({
          a: 1,
          p1: 1,
          p2: 1,
          b: 1,
        });

        expect(outputs).toEqual({
          a: "A",
          parallel: ["P1", "P2", undefined, undefined],
          b: "B",
        });
      }, 5000);
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThan(2999);
      expect(duration).toBeLessThan(3500);
    });

    it<TestContext>("sequential group", async ({ client }) => {
      const counters = {
        a: 0,
        p1: 0,
        p2_1: 0,
        p2_2: 0,
        b: 0,
      };
      const outputs: Record<string, unknown> = {
        a: undefined,
        parallel: undefined,
        b: undefined,
      };
      const workflow = client.workflow(
        { id: "workflow" },
        async (ctx, step) => {
          outputs.a = await step.run("a", async () => {
            counters.a++;
            return "A";
          });

          outputs.parallel = await Promise.all([
            step.run("p1", async () => {
              counters.p1++;
              return "P1";
            }),
            (async () => {
              const output = await step.run("p2.1", async () => {
                counters.p2_1++;
                return "P2.1";
              });
              return step.run("p2.2", async () => {
                counters.p2_2++;
                return `${output} P2.2`;
              });
            })(),
          ]);

          outputs.b = await step.run("b", async () => {
            // Sleep to give race conditions a chance to happen
            await sleep(1000);

            counters.b++;
            return "B";
          });
        }
      );

      await workflow.start({});
      await vi.waitFor(() => {
        expect(counters).toEqual({
          a: 1,
          p1: 1,
          p2_1: 1,
          p2_2: 1,
          b: 1,
        });

        expect(outputs).toEqual({
          a: "A",
          parallel: ["P1", "P2.1 P2.2"],
          b: "B",
        });
      }, 5000);
    });
  });
}
