import { describe, expect, it, onTestFinished, vi } from "vitest";

import type { BaseClient } from "@stepkit/sdk-tools";

export function workflowSuite<TClient extends BaseClient>(
  createClient: () => TClient | Promise<TClient>,
  cleanup: (client: TClient) => void | Promise<void>
): void {
  describe("step.sleep", () => {
    it("parallel steps", async () => {
      const client = await createClient();
      onTestFinished(async () => cleanup(client));

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
      expect(duration).toBeGreaterThan(1999);

      // Sometimes it takes upwards of 3.5 seconds. It's unclear why
      expect(duration).toBeLessThan(4000);
    });
  });
}
