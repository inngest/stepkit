import { Inngest } from "inngest";

import {
  BaseClient,
  type ExtDefault,
  type InputDefault,
  type StartData,
  type Workflow,
} from "@stepkit/sdk-tools";

import { API } from "./api";
import { defaultEventName } from "./inngestify";

export type ReceivedEvent = {
  data: Record<string, unknown>;
  id: string;
  name: string;
  ts: number;
  v: string | undefined;
};

export type SentEvent = {
  data?: Record<string, unknown>;
  id?: string;
  name: string;
  ts?: number;
  v?: string;
};

export type StepExt = {
  sendEvent: (stepId: string, event: SentEvent) => Promise<{ ids: string[] }>;

  waitForEvent: (
    stepId: string,
    opts: { event: string; timeout: number | string | Date }
  ) => Promise<ReceivedEvent | null>;
};

export class InngestClient extends BaseClient<ExtDefault, ExtDefault, StepExt> {
  private readonly api: API;
  private readonly hasEventKey: boolean;
  private readonly hasSigningKey: boolean;
  private readonly mode: "cloud" | "dev";
  inngest: Inngest;

  constructor({ id, mode = "cloud" }: { id: string; mode?: "cloud" | "dev" }) {
    super();
    this.inngest = new Inngest({ id, isDev: mode === "dev" });

    this.hasEventKey =
      process.env.INNGEST_EVENT_KEY !== undefined &&
      process.env.INNGEST_EVENT_KEY !== "";

    this.hasSigningKey =
      process.env.INNGEST_SIGNING_KEY !== undefined &&
      process.env.INNGEST_SIGNING_KEY !== "";

    this.mode = mode;

    let baseUrl = "https://api.inngest.com";
    if (mode === "dev") {
      baseUrl = "http://localhost:8288";
    }
    this.api = new API({
      apiKey: process.env.INNGEST_SIGNING_KEY,
      baseUrl,
    });
  }

  async startWorkflow<TInput extends InputDefault>(
    workflow: Workflow<TInput, any, ExtDefault, ExtDefault, StepExt>,
    input: TInput
  ): Promise<StartData> {
    // TODO: Reimplement this using a dedicated REST endpoint. The current
    // approach of polling for the run ID takes way too long (~15 seconds)

    if (this.mode === "cloud") {
      if (!this.hasEventKey) {
        throw new Error("INNGEST_EVENT_KEY env var is not set");
      }
    } else {
      if (!this.hasSigningKey) {
        throw new Error("INNGEST_SIGNING_KEY env var is not set");
      }
    }

    let eventName: string | undefined;
    for (const trigger of workflow.triggers ?? []) {
      if (trigger.type === "event") {
        eventName = trigger.name;
        break;
      }
    }
    eventName = eventName ?? defaultEventName(this.inngest.id, workflow.id);

    const { ids } = await this.inngest.send({
      name: eventName,
      data: input,
    });
    if (ids[0] === undefined) {
      throw new Error("unreachable: no ids");
    }
    const eventId = ids[0];
    const runId = await this.api.getRunId(eventId);

    return {
      eventId,
      runId,
    };
  }
}
