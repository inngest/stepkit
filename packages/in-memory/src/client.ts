import {
  BaseClient,
  createStdStep,
  type InputDefault,
  type ReportOp,
  type StartData,
  type Step,
  type Workflow,
} from "@stepkit/sdk-tools";

import { Orchestrator } from "./orchestrator";

export class InMemoryClient extends BaseClient {
  private orc: Orchestrator;

  constructor() {
    super();
    this.orc = new Orchestrator(this.workflows);
  }

  start(): void {
    this.orc.start();
  }

  stop(): void {
    this.orc.stop();
  }

  async getStep(reportOp: ReportOp): Promise<Step> {
    return createStdStep(reportOp);
  }

  async invoke<TInput extends InputDefault, TOutput>(
    workflow: Workflow<TInput, TOutput>,
    data: TInput
  ): Promise<TOutput> {
    return this.orc.invoke(workflow, data);
  }

  async startWorkflow<TInput extends InputDefault>(
    workflow: Workflow<TInput, any>,
    data: TInput
  ): Promise<StartData> {
    return this.orc.startWorkflow(workflow, data);
  }
}
