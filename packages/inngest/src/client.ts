import { Inngest } from "inngest";

import {
  BaseClient,
  type ExtDefault,
  type InputDefault,
  type StartData,
  type Workflow,
} from "@stepkit/sdk-tools";

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
  inngest: Inngest;

  constructor({ id }: { id: string }) {
    super();
    this.inngest = new Inngest({ id });
  }

  startWorkflow<TInput extends InputDefault>(
    _workflow: Workflow<TInput, any, ExtDefault, ExtDefault, StepExt>,
    _input: TInput
  ): Promise<StartData> {
    throw new Error("not implemented");
  }
}
