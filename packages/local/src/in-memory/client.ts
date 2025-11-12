import {
  BaseClient,
  createStdStep,
  type InputDefault,
  type ReportOp,
  type StartData,
  type Step,
  type Workflow,
} from "@stepkit/sdk-tools";

import { Orchestrator } from "../common/orchestrator";
import type { EventQueueData, ExecQueueData } from "../common/queue";
import { InMemoryDriver } from "./executionDriver";
import { InMemorySortedQueue } from "./queue";
import { InMemoryStateDriver } from "./stateDriver";

export class InMemoryClient extends BaseClient {
  private orc: Orchestrator;

  constructor() {
    super();

    const eventQueue = new InMemorySortedQueue<EventQueueData>();
    const stateDriver = new InMemoryStateDriver();
    const execDriver = new InMemoryDriver(stateDriver);
    const execQueue = new InMemorySortedQueue<ExecQueueData>();

    this.orc = new Orchestrator({
      eventQueue,
      stateDriver,
      execDriver,
      execQueue,
      workflows: this.workflows,
    });
    this.orc.start();
  }

  stop(): void {
    this.orc.stop();
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
