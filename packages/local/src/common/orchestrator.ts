import {
  fromJsonError,
  getStepKitErrorProps,
  isOpResult,
  StdOpCode,
  type BaseExecutionDriver,
  type Input,
  type InputDefault,
  type OpResult,
  type SendSignalOpts,
  type StartData,
  type Workflow,
} from "@stepkit/sdk-tools";

import { UnreachableError } from "./errors";
import type { SortedQueue } from "./queue";
import type { LocalStateDriver, Run } from "./stateDriver";
import { sleep } from "./utils";

const defaultMaxAttempts = 4;

type EventQueueData = Input<any, "event">;

type ExecQueueData = {
  attempt: number;

  // OpResult that preceeded this queue item. For example, when a `step.run`
  // completes then we schedule a new queue item for the next execution
  prevOpResult?: OpResult;

  runId: string;
  workflowId: string;
};

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
    if (exec.prevOpResult !== undefined) {
      if (isOpResult.sleep(exec.prevOpResult)) {
        await this.stateDriver.wakeSleepOp(
          {
            runId: exec.runId,
            hashedOpId: exec.prevOpResult.id.hashed,
          },
          exec.prevOpResult
        );
      } else if (isOpResult.waitForSignal(exec.prevOpResult)) {
        await this.stateDriver.timeoutWaitForSignalOp(
          exec.prevOpResult.config.options.signal
        );
      } else if (isOpResult.invokeWorkflow(exec.prevOpResult)) {
        await this.stateDriver.timeoutInvokeWorkflowOp({
          hashedOpId: exec.prevOpResult.id.hashed,
          runId: exec.runId,
        });
      }
    }

    const ops = await this.execDriver.execute(workflow, run.ctx);
    if (ops.length === 0) {
      throw new UnreachableError("no ops found");
    }

    // console.log("ops", ops);
    for (const op of ops) {
      if (shouldEndRun(op, run, exec)) {
        await this.stateDriver.endRun(run.ctx.runId, op);
        const waitingInvoke = await this.stateDriver.resumeInvokeWorkflowOp({
          childRunId: run.ctx.runId,
          op,
        });
        if (waitingInvoke !== null) {
          await this.execQueue.add({
            data: {
              attempt: 1,
              prevOpResult: waitingInvoke.op,
              runId: waitingInvoke.parentRun.runId,
              workflowId: waitingInvoke.parentRun.workflowId,
            },
            time: Date.now(),
          });
        }
        return;
      }

      let time = Date.now();
      if (isOpResult.sleep(op)) {
        time = op.config.options.wakeAt;
      } else if (isOpResult.waitForSignal(op)) {
        await this.stateDriver.addWaitingSignal({
          op,
          runId: run.ctx.runId,
          workflowId: run.workflowId,
        });
        time = Date.now() + op.config.options.timeout;
      } else if (isOpResult.invokeWorkflow(op)) {
        const invokedStartData = await this.startWorkflow({
          data: op.config.options.data,

          // TODO
          maxAttempts: defaultMaxAttempts,

          workflowId: op.config.options.workflowId,
        });

        await this.stateDriver.waitingInvokes.add({
          op,
          childRun: {
            runId: invokedStartData.runId,
            workflowId: op.config.options.workflowId,
          },
          parentRun: {
            runId: run.ctx.runId,
            workflowId: run.workflowId,
          },
        });
        time = Date.now() + op.config.options.timeout;
      }

      await this.execQueue.add({
        data: {
          attempt: nextAttempt(op, exec, run),
          prevOpResult: op,
          runId: run.ctx.runId,
          workflowId: run.workflowId,
        },
        time,
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
      // console.log("waiting for run to end", i);
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
      throw fromJsonError(run.result.error);
    }
  }

  async processIncomingSignal(opts: SendSignalOpts): Promise<string | null> {
    const waitingSignal = await this.stateDriver.popWaitingSignal(opts.signal);
    if (waitingSignal === null) {
      return null;
    }
    await this.stateDriver.resumeWaitForSignalOp({
      data: opts.data,
      waitingSignal,
    });

    await this.execQueue.add({
      data: {
        attempt: 1,
        runId: waitingSignal.runId,
        workflowId: waitingSignal.workflowId,
      },
      time: Date.now(),
    });
    return waitingSignal.runId;
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
    const eventId = crypto.randomUUID();
    const runId = crypto.randomUUID();

    await this.stateDriver.addRun({
      ctx: {
        ext: {},
        input: {
          data,
          ext: {},
          id: eventId,
          name: workflowId,
          time: new Date(),
          type: "invoke",
        },
        runId,
      },
      result: undefined,
      maxAttempts,
      opAttempts: {},
      workflowId,
    });

    await this.execQueue.add({
      data: {
        attempt: 1,
        runId,
        workflowId,
      },
      time: Date.now(),
    });

    return {
      eventId,
      runId,
    };
  }
}

/**
 * Determines if the run should end
 */
function shouldEndRun(
  op: OpResult,
  run: Run,
  queueItem: ExecQueueData
): boolean {
  if (op.result.status === "success") {
    if (op.config.code === StdOpCode.workflow) {
      // Run was successful
      return true;
    }
    // Step was successful
    return false;
  }

  const error = fromJsonError(op.result.error);
  const canRetry = getStepKitErrorProps(error)?.canRetry ?? true;
  if (!canRetry) {
    // Non-retryable error
    return true;
  }

  const exhaustedAttempts = queueItem.attempt >= run.maxAttempts;
  if (!exhaustedAttempts) {
    // Has remaining attempts
    return false;
  }

  if (op.config.code === StdOpCode.workflow) {
    // Workflow-level error with no remaining attempts
    return true;
  }

  // Step-level error with no remaining attempts. But the run is not done yet
  // since the error needs to be thrown at the workflow level
  return false;
}

/**
 * Determines the attempt number for the next execution queue item
 */
function nextAttempt(op: OpResult, exec: ExecQueueData, run: Run): number {
  if (op.result.status !== "error") {
    // Success, so reset attempt
    return 1;
  }

  const exhaustedAttempts = exec.attempt >= run.maxAttempts;
  if (exhaustedAttempts && op.config.code !== StdOpCode.workflow) {
    // Step-level error with no remaining attempts. But we need to reset the
    // attempt since the error needs to be thrown at the workflow level
    return 1;
  }

  // Next attempt
  return exec.attempt + 1;
}
