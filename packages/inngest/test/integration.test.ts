/* eslint-disable @typescript-eslint/no-unsafe-argument */

import type { AddressInfo } from "net";

import express from "express";
import { serve } from "inngest/express";
import { expect, it, onTestFinished, vi } from "vitest";
import z from "zod";

import { NonRetryableError } from "@stepkit/core";
import type { Context } from "@stepkit/sdk-tools";

import { InngestClient, inngestify } from "../src/main";
import { sleep } from "../src/utils";

it("multiple steps", async () => {
  const client = new InngestClient({ id: crypto.randomUUID(), mode: "dev" });
  const eventName = `event-${crypto.randomUUID()}`;
  const counters = {
    top: 0,
    getGreeting: 0,
    getName: 0,
    bottom: 0,
  };
  const workflow = client.workflow(
    {
      id: "workflow",
      triggers: [{ type: "event", name: eventName }],
    },
    async (ctx, step) => {
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
    }
  );

  const close = await startServer(client, [workflow]);
  onTestFinished(close);

  await client.inngest.send({
    data: { msg: "hi" },
    name: eventName,
  });

  await vi.waitFor(() => {
    expect(counters).toEqual({
      top: 3,
      getGreeting: 1,
      getName: 1,
      bottom: 1,
    });
  }, 2000);
});

it("NonRetryableError", async () => {
  const client = new InngestClient({ id: crypto.randomUUID(), mode: "dev" });
  const eventName = `event-${crypto.randomUUID()}`;
  const counters = {
    top: 0,
    step: 0,
    catch: 0,
    bottom: 0,
  };
  let caughtError: unknown;
  const workflow = client.workflow(
    {
      id: "workflow",
      triggers: [{ type: "event", name: eventName }],
    },
    async (ctx, step) => {
      counters.top++;

      try {
        await step.run("a", async () => {
          counters.step++;
          throw new NonRetryableError("oh no");
        });
      } catch (e) {
        counters.catch++;
        caughtError = e;
        throw e;
      }
      counters.bottom++;
    }
  );

  const close = await startServer(client, [workflow]);
  onTestFinished(close);

  await client.inngest.send({
    data: { msg: "hi" },
    name: eventName,
  });

  await vi.waitFor(
    () => {
      expect(counters).toEqual({
        top: 2,
        step: 1,
        catch: 1,
        bottom: 0,
      });
    },
    { timeout: 5_000 }
  );
  expect(caughtError).toBeInstanceOf(Error);
});

it("startWorkflow", async () => {
  const client = new InngestClient({ id: crypto.randomUUID(), mode: "dev" });
  const eventName = `event-${crypto.randomUUID()}`;
  let receivedCtx: Context | undefined;
  const workflow = client.workflow(
    {
      id: "workflow",
      triggers: [{ type: "event", name: eventName }],
    },
    async (ctx) => {
      receivedCtx = ctx;
    }
  );

  const close = await startServer(client, [workflow]);
  onTestFinished(close);

  const startData = await workflow.start({ msg: "hi" });
  await vi.waitFor(() => {
    expect(receivedCtx?.input.data).toEqual({ msg: "hi" });
    expect(receivedCtx?.input.id).toBe(startData.eventId);
    expect(receivedCtx?.runId).toBe(startData.runId);
  });
});

async function startServer(
  client: InngestClient,
  workflows: Parameters<typeof inngestify>[1]
): Promise<() => void> {
  // Start the server with a random port
  const app = express();
  app.use(express.json());
  app.use("/api/inngest", serve(inngestify(client, workflows)));
  const server = app.listen(0);

  // Sync the Inngest endpoint
  const { port } = server.address() as AddressInfo;
  const resp = await fetch(`http://localhost:${String(port)}/api/inngest`, {
    method: "PUT",
  });
  expect(resp.status).toBe(200);

  return () => {
    server.close();
  };
}

it("step.waitForSignal", async () => {
  const client = new InngestClient({ id: crypto.randomUUID(), mode: "dev" });
  const eventName = `event-${crypto.randomUUID()}`;
  const signal = `signal-${crypto.randomUUID()}`;
  const counters = {
    top: 0,
    bottom: 0,
  };
  let waitResult: { data: { msg: string }; signal: string } | null = null;
  const workflow = client.workflow(
    {
      id: "workflow",
      triggers: [{ type: "event", name: eventName }],
    },
    async (ctx, step) => {
      counters.top++;

      waitResult = await step.waitForSignal("a", {
        schema: z.object({ msg: z.string() }),
        signal,
        timeout: 10_000,
      });

      counters.bottom++;
    }
  );

  const close = await startServer(client, [workflow]);
  onTestFinished(close);

  await workflow.start({});

  // Sleep a little to ensure the `waitForSignal` step is processed
  await sleep(2000);
  await client.sendSignal({
    signal,
    data: { msg: "hi" },
  });

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
