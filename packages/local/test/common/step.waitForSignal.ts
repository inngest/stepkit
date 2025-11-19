import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { BaseClient } from "@stepkit/sdk-tools";

import { sleep } from "../../src/common/utils";

export function stepWaitForSignalSuite<TClient extends BaseClient>(
  createClient: () => TClient | Promise<TClient>,
  cleanup: (client: TClient) => void | Promise<void>
): void {
  interface TestContext {
    client: TClient;
  }

  describe.concurrent("step.waitForSignal", () => {
    beforeEach<TestContext>(async (ctx) => {
      ctx.client = await createClient();
    });
    afterEach<TestContext>(async ({ client }) => {
      await cleanup(client);
    });

    it<TestContext>("resolve", async ({ client }) => {
      const signal = `signal-${crypto.randomUUID()}`;
      let runID: string | undefined;
      const counters = {
        top: 0,
        bottom: 0,
      };
      let waitResult: { data: { msg: string }; signal: string } | null = null;
      const workflow = client.workflow(
        { id: "workflow" },
        async (ctx, step) => {
          runID = ctx.runId;
          counters.top++;

          waitResult = await step.waitForSignal("a", {
            schema: z.object({ msg: z.string() }),
            signal,
            timeout: 10_000,
          });

          counters.bottom++;
        }
      );

      await workflow.start({});

      // Sleep a little to ensure the `waitForSignal` step is processed
      await sleep(2000);
      const sendResult = await client.sendSignal({
        signal,
        data: { msg: "hi" },
      });
      expect(sendResult.runId).toEqual(runID);

      await vi.waitFor(() => {
        expect(counters).toEqual({
          top: 2,
          bottom: 1,
        });
      }, 5_000);
      expect(waitResult).toEqual({
        data: { msg: "hi" },
        signal,
      });
    });

    it<TestContext>("timeout", async ({ client }) => {
      const counters = {
        top: 0,
        bottom: 0,
      };
      let waitResult: { data: { msg: string }; signal: string } | null = null;
      const workflow = client.workflow(
        { id: "workflow" },
        async (ctx, step) => {
          counters.top++;

          waitResult = await step.waitForSignal("a", {
            signal: `signal-${crypto.randomUUID()}`,
            timeout: 1_000,
          });

          counters.bottom++;
        }
      );

      await workflow.start({});

      await vi.waitFor(() => {
        expect(counters).toEqual({
          top: 2,
          bottom: 1,
        });
      }, 5_000);
      expect(waitResult).toBeNull();
    });
  });
}
