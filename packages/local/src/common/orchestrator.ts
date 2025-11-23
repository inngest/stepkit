import {
  fromJsonError,
  type BaseExecutionDriver,
  type Input,
  type InputDefault,
  type SendSignalOpts,
  type StartData,
  type Workflow,
} from "@stepkit/sdk-tools";

import { defaultMaxAttempts } from "./consts";
import { UnreachableError } from "./errors";
import { execQueueItemPreExecution, handleOpResult } from "./handlers/main";
import { processIncomingSignal } from "./handlers/waitForSignal";
import type { EventQueueData, ExecQueueData, SortedQueue } from "./queue";
import type { LocalStateDriver } from "./stateDriver";
import { sleep, startWorkflow } from "./utils";

/**
 * High-level orchestrator for events and runs. Manages state and execution
 */
export class Orchestrator {
  private eventQueue: SortedQueue<EventQueueData>;
  private execDriver: BaseExecutionDriver;
  private execQueue: SortedQueue<ExecQueueData>;
  private stateDriver: LocalStateDriver;
  private stops: (() => void)[];
  private workflows: Map<string, Workflow<any, any>>;

  constructor({
    eventQueue,
    execDriver,
    stateDriver,
    execQueue,
    workflows,
  }: {
    eventQueue: SortedQueue<EventQueueData>;
    execDriver: BaseExecutionDriver;
    execQueue: SortedQueue<ExecQueueData>;
    stateDriver: LocalStateDriver;
    workflows: Map<string, Workflow<any, any>>;
  }) {
    this.eventQueue = eventQueue;
    this.stateDriver = stateDriver;
    this.execDriver = execDriver;
    this.execQueue = execQueue;
    this.stops = [];
    this.workflows = workflows;
  }

  start(): void {
    this.stops.push(
      this.eventQueue.handle((event) => this.handleEventQueue(event.data))
    );

    this.stops.push(
      this.execQueue.handle((op) => this.handleExecQueue(op.data))
    );
  }

  stop(): void {
    for (const stop of this.stops) {
      stop();
    }
  }

  /**
   * Process event queue items. Triggers workflow runs if necessary
   */
  private async handleEventQueue(event: Input<any, "event">): Promise<void> {
    for (const workflow of this.workflows.values()) {
      if (workflow.triggers === undefined) {
        continue;
      }

      const isTriggered = workflow.triggers.some((trigger) => {
        return trigger.type === "event" && trigger.name === event.name;
      });
      if (isTriggered) {
        await this.startWorkflow({
          data: event.data,
          maxAttempts: workflow.maxAttempts ?? defaultMaxAttempts,
          workflowId: workflow.id,
        });
      }
    }
  }

  /**
   * Process execution queue items. Executes the run and schedules new queue
   * items if necessary
   */
  private async handleExecQueue(exec: ExecQueueData): Promise<void> {
    const run = await this.stateDriver.getRun(exec.runId);
    if (run === undefined) {
      throw new UnreachableError("run not found");
    }

    const workflow = this.workflows.get(run.workflowId);
    if (workflow === undefined) {
      throw new UnreachableError("workflow not found");
    }
    const allowExecution = await execQueueItemPreExecution({
      queueItem: exec,
      stateDriver: this.stateDriver,
    });
    if (!allowExecution) {
      return;
    }

    let targetHashedOpId: string | undefined;
    if (exec.action.code === "targetOp") {
      targetHashedOpId = exec.action.hashedOpId;
    }

    const ops = await this.execDriver.execute({
      ctx: run.ctx,
      targetHashedOpId,
      workflow,
    });
    if (ops.length === 0) {
      throw new UnreachableError("no ops found");
    }

    for (const op of ops) {
      await handleOpResult({
        execQueue: this.execQueue,
        op,
        queueItem: exec,
        stateDriver: this.stateDriver,
        workflowId: run.workflowId,
        workflows: this.workflows,
      });
    }
  }

  /**
   * Start a workflow run and wait for it to end
   */
  async invoke<TInput extends InputDefault, TOutput>(
    workflow: Workflow<TInput, TOutput>,
    data: TInput
  ): Promise<TOutput> {
    const { runId } = await this.startWorkflow({
      data,
      maxAttempts: workflow.maxAttempts ?? defaultMaxAttempts,
      workflowId: workflow.id,
    });
    let i = 0;

    // TODO: Should we add a timeout? An infinite loop feels dirty
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      i++;
      if (i > 1) {
        await sleep(100);
      }

      const run = await this.stateDriver.getRun(runId);
      // console.log("run", run);
      if (run === undefined) {
        throw new UnreachableError("run not found");
      }
      if (run.result === undefined) {
        continue;
      }
      if (run.result.status === "success") {
        // @ts-expect-error - Necessary because of generics
        return run.result.output;
      }
      if (run.result.status === "plan") {
        throw new UnreachableError("status is plan");
      }
      throw fromJsonError(run.result.error);
    }
  }

  async processIncomingSignal(opts: SendSignalOpts): Promise<string | null> {
    return processIncomingSignal({
      opts,
      stateDriver: this.stateDriver,
      workflows: this.workflows,
      execQueue: this.execQueue,
    });
  }

  /**
   * Start a workflow run but don't wait for it to end
   */
  async startWorkflow({
    data,
    maxAttempts,
    workflowId,
  }: {
    data: unknown;
    maxAttempts: number;
    workflowId: string;
  }): Promise<StartData> {
    return startWorkflow({
      data,
      maxAttempts,
      workflowId,
      stateDriver: this.stateDriver,
      execQueue: this.execQueue,
    });
  }
}
