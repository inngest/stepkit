import { z } from "zod";

import type { SendSignalOpts } from "@stepkit/core/implementer";

import { sleep } from "./utils";

export class API {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor({
    apiKey,
    baseUrl,
  }: {
    apiKey: string | undefined;
    baseUrl: string;
  }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async getRunId(eventId: string): Promise<string> {
    const timeout = new Date(Date.now() + 60_000);
    let i = 0;
    while (new Date() < timeout) {
      i++;
      if (i > 1) {
        await sleep(5000);
      }

      const headers: Record<string, string> = {};
      if (this.apiKey !== undefined) {
        headers.authorization = `Bearer ${this.apiKey}`;
      }

      const resp = await fetch(`${this.baseUrl}/v1/events/${eventId}/runs`, {
        headers,
      });
      if (resp.status !== 200) {
        continue;
      }
      const body = eventRunsSchema.parse(await resp.json());
      if (body.data[0] === undefined) {
        continue;
      }
      return body.data[0].run_id;
    }
    throw new Error("timeout: no run ID found");
  }

  async sendSignal(opts: SendSignalOpts): Promise<{ runId: string | null }> {
    const headers: Record<string, string> = {};
    if (this.apiKey !== undefined) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }
    const resp = await fetch(`${this.baseUrl}/v1/signals`, {
      body: JSON.stringify({
        signal: opts.signal,
        data: opts.data,
      }),
      headers,
      method: "POST",
    });
    if (resp.status !== 200) {
      throw new Error(`failed to send signal: ${resp.statusText}`);
    }

    const runId = signalResponseSchema.parse(await resp.json()).data.run_id;
    if (runId === undefined) {
      return { runId: null };
    }
    return { runId };
  }
}

// Schema for the `GET /v1/events/{id}/runs` response body
const eventRunsSchema = z.object({
  data: z.array(
    z.object({
      run_id: z.string(),
    })
  ),
});

// Schema for the `POST /v1/signals` response body
const signalResponseSchema = z.object({
  data: z.object({
    run_id: z.string().optional(),
  }),
});
