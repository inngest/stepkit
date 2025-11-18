import {
  BaseClient,
  type InputDefault,
  type SendSignalOpts,
  type StartData,
  type Workflow,
} from "@stepkit/sdk-tools";

import { Orchestrator } from "../common/orchestrator";
import type { EventQueueData, ExecQueueData } from "../common/queue";
import { FileSystemDriver } from "./executionDriver";
import { FileSystemSortedQueue } from "./queue";
import { FileSystemStateDriver } from "./stateDriver";

type FileSystemClientOptions = {
  baseDir?: string;
};

const defaultMaxAttempts = 4;

export class FileSystemClient extends BaseClient {
  readonly baseDir: string;
  private orc: Orchestrator;

  constructor(options: FileSystemClientOptions = {}) {
    super();
    this.baseDir = options.baseDir ?? "./.stepkit";

    const eventQueue = new FileSystemSortedQueue<EventQueueData>(
      this.baseDir,
      "event"
    );
    const stateDriver = new FileSystemStateDriver(this.baseDir);
    const execDriver = new FileSystemDriver(stateDriver);
    const execQueue = new FileSystemSortedQueue<ExecQueueData>(
      this.baseDir,
      "exec"
    );

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

  async sendSignal(opts: SendSignalOpts): Promise<{ runId: string | null }> {
    return { runId: await this.orc.processIncomingSignal(opts) };
  }

  async startWorkflow<TInput extends InputDefault>(
    workflow: Workflow<TInput, any>,
    data: TInput
  ): Promise<StartData> {
    return this.orc.startWorkflow({
      data,
      maxAttempts: workflow.maxAttempts ?? defaultMaxAttempts,
      workflowId: workflow.id,
    });
  }
}
