import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, onTestFinished, vi } from "vitest";
import z from "zod";

import { sleep } from "../../src/common/utils";
import { FileSystemClient } from "../../src/main";

describe("startWorkflow", () => {
  it("step.run", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "stepkit-test-"));
    onTestFinished(async () => fs.rm(baseDir, { recursive: true }));
    const client = new FileSystemClient({ baseDir });
    onTestFinished(() => client.stop());

    const counters = {
      top: 0,
      getGreeting: 0,
      getName: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async (ctx, step) => {
      counters.top++;

      const greeting = await step.run("get-greeting", async () => {
        counters.getGreeting++;
        return "Hello";
      });

      const name = await step.run("get-name", async () => {
        counters.getName++;
        return "Alice";
      });
      counters.bottom++;
      return `${greeting}, ${name}!`;
    });

    await workflow.start({ msg: "hi" });
    await vi.waitFor(() => {
      expect(counters).toEqual({
        top: 3,
        getGreeting: 1,
        getName: 1,
        bottom: 1,
      });
    });
  });

  describe("step.waitForSignal", () => {
    it("resolve", async () => {
      const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "stepkit-test-"));
      onTestFinished(async () => fs.rm(baseDir, { recursive: true }));
      const client = new FileSystemClient({ baseDir });
      onTestFinished(() => client.stop());

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
      }, 10_000);
      expect(waitResult).toEqual({
        data: { msg: "hi" },
        signal,
      });
    }, 10_000);

    it("timeout", async () => {
      const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "stepkit-test-"));
      onTestFinished(async () => fs.rm(baseDir, { recursive: true }));
      const client = new FileSystemClient({ baseDir });
      onTestFinished(() => client.stop());

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
});
