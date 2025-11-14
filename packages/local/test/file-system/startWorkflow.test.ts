import fs, { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from "vitest";
import z from "zod";

import { sleep } from "../../src/common/utils";
import { FileSystemClient } from "../../src/main";

const stateDir = resolve("./.stepkit/startWorkflow-test");

export async function cleanup(): Promise<void> {
  try {
    await fs.rm(stateDir, { recursive: true, force: true });
  } catch {
    // Ignore
  }
}

describe("startWorkflow", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  let client: FileSystemClient;
  beforeEach(() => {
    client = new FileSystemClient({
      baseDir: `${stateDir}/${crypto.randomUUID()}`,
    });
  });
  afterEach(() => client.stop());

  it("step.run", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "stepkit-test-"));
    onTestFinished(async () => rm(baseDir, { recursive: true }));

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

  it("step.waitForSignal", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "stepkit-test-"));
    onTestFinished(async () => rm(baseDir, { recursive: true }));

    const client = new FileSystemClient({ baseDir });
    onTestFinished(() => client.stop());

    const signal = `signal-${crypto.randomUUID()}`;
    let runID: string | undefined;
    const counters = {
      top: 0,
      bottom: 0,
    };
    let waitResult: { data: { msg: string }; signal: string } | null = null;
    const workflow = client.workflow({ id: "workflow" }, async (ctx, step) => {
      runID = ctx.runId;
      counters.top++;

      waitResult = await step.waitForSignal("a", {
        schema: z.object({ msg: z.string() }),
        signal,
        timeout: 10_000,
      });

      counters.bottom++;
    });

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
    });
    expect(waitResult).toEqual({
      data: { msg: "hi" },
      signal,
    });
  });
});
