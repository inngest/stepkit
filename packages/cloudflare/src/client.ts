import {
  BaseClient,
  type InputDefault,
  type SendSignalOpts,
  type StartData,
  type Workflow,
} from "@stepkit/sdk-tools";

export class CloudflareClient extends BaseClient {
  async invoke<TInput extends InputDefault>(
    workflow: Workflow<TInput, any>,
    input: TInput
  ): Promise<StartData> {
    const resp = await fetch("http://localhost:8787", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (resp.status !== 200) {
      throw new Error(`Failed to start workflow: ${resp.statusText}`);
    }
    return await resp.json();
  }

  async sendSignal(_opts: SendSignalOpts): Promise<{ runId: string | null }> {
    throw new Error("not implemented");
  }

  async startWorkflow<TInput extends InputDefault>(
    _workflow: Workflow<TInput, any>,
    _input: TInput
  ): Promise<StartData> {
    throw new Error("not implemented");
  }
}
