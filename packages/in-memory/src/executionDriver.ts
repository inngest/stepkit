import {
  BaseExecutionDriver,
  createStdStep,
  executeUntilDone,
  type Context,
  type InputDefault,
  type ReportOp,
  type StartData,
  type Step,
  type Workflow,
} from "@stepkit/sdk-tools";

import { InMemoryStateDriver } from "./stateDriver";

const defaultMaxAttempts = 4;

export class InMemoryDriver extends BaseExecutionDriver {
  private processEventsInterval: NodeJS.Timeout | undefined;
  private processRunsInterval: NodeJS.Timeout | undefined;
  private stateDriver: InMemoryStateDriver;

  constructor() {
    const state = new InMemoryStateDriver();
    super(state);
    this.stateDriver = state;
    this.workflows = new Map();
  }

  start(): void {
    this.processEventsInterval = setInterval(() => {
      this.processEvents();
    }, 500);
    this.processRunsInterval = setInterval(() => {
      this.processRuns();
    }, 500);
  }

  stop(): void {
    if (this.processEventsInterval !== undefined) {
      clearInterval(this.processEventsInterval);
    }
    if (this.processRunsInterval !== undefined) {
      clearInterval(this.processRunsInterval);
    }
  }

  async getStep(reportOp: ReportOp): Promise<Step> {
    return createStdStep(reportOp);
  }

  private processEvents(): void {
    for (const event of this.stateDriver.getUnprocessedEvents()) {
      for (const workflow of this.workflows.values()) {
        if (workflow.triggers === undefined) {
          continue;
        }

        const isTriggered = workflow.triggers.some((trigger) => {
          return trigger.type === "event" && trigger.name === event.name;
        });
        if (isTriggered) {
          this.stateDriver.addRun({
            ctx: {
              ext: {},
              input: event,
              runId: crypto.randomUUID(),
            },
            output: undefined,
            maxAttempts: workflow.maxAttempts ?? defaultMaxAttempts,
            opAttempts: {},
            workflowId: workflow.id,
          });
        }
      }

      this.stateDriver.removeEvent(event.id);
    }
  }

  private processRuns(): void {
    for (const run of this.stateDriver.getActiveRuns().values()) {
      const workflow = this.workflows.get(run.workflowId);
      if (workflow === undefined) {
        console.error(`unreachable: workflow not found: ${run.workflowId}`);
        continue;
      }

      void executeUntilDone(
        (ctx, workflow) => this.execute(workflow, ctx),
        workflow,
        run.ctx
      ).finally(() => {
        this.stateDriver.endRun(run.ctx.runId);
      });
    }
  }

  async invoke<TInput extends InputDefault, TOutput>(
    workflow: Workflow<TInput, TOutput>,
    data: TInput
  ): Promise<TOutput> {
    const ctx: Context<TInput> = {
      ext: {},
      input: {
        data,
        ext: {},
        id: crypto.randomUUID(),
        name: "in-memory",
        time: new Date(),
        type: "invoke",
      },
      runId: crypto.randomUUID(),
    };
    this.stateDriver.addRun({
      ctx,
      maxAttempts: workflow.maxAttempts ?? defaultMaxAttempts,
      opAttempts: {},
      output: undefined,
      workflowId: workflow.id,
    });

    try {
      return await executeUntilDone(
        (ctx, workflow) => this.execute(workflow, ctx),
        workflow,
        ctx
      );
    } finally {
      this.stateDriver.endRun(ctx.runId);
    }
  }

  async startWorkflow<TInput extends InputDefault>(
    workflow: Workflow<TInput, any>,
    data: TInput
  ): Promise<StartData> {
    const eventId = crypto.randomUUID();
    const runId = crypto.randomUUID();
    this.stateDriver.addRun({
      ctx: {
        ext: {},
        input: {
          data,
          ext: {},
          id: eventId,
          name: workflow.id,
          time: new Date(),
          type: "invoke",
        },
        runId,
      },
      maxAttempts: workflow.maxAttempts ?? defaultMaxAttempts,
      opAttempts: {},
      output: undefined,
      workflowId: workflow.id,
    });
    return {
      eventId,
      runId,
    };
  }
}
