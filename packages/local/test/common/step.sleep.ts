import { describe, expect, it, onTestFinished, vi } from "vitest";

import type { BaseClient } from "@stepkit/sdk-tools";

export function stepSleepSuite<TClient extends BaseClient>(
  createClient: () => TClient | Promise<TClient>,
  cleanup: (client: TClient) => void | Promise<void>
): void {
  describe("step.sleep", () => {
    it("success", async () => {
      const client = await createClient();
      onTestFinished(async () => cleanup(client));

      const counters = {
        top: 0,
        bottom: 0,
      };
      const workflow = client.workflow(
        { id: "workflow" },
        async (ctx, step) => {
          counters.top++;
          await step.sleep("get-greeting", 1000);
          counters.bottom++;
        }
      );

      const start = Date.now();
      await client.startWorkflow(workflow, {});
      await vi.waitFor(() => {
        expect(counters).toEqual({
          top: 2,
          bottom: 1,
        });
      }, 2000);
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThan(999);
      expect(duration).toBeLessThan(1200);
    });
  });
}
