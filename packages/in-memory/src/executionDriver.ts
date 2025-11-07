import {
  BaseExecutionDriver,
  createStdStep,
  executeUntilDone,
  type ReportOp,
  type Step,
  type Workflow,
} from "@stepkit/sdk-tools";

import type { InMemoryStateDriver } from "./stateDriver";

const defaultMaxAttempts = 4;

export class InMemoryDriver extends BaseExecutionDriver {
  private processEventsInterval: NodeJS.Timeout | undefined;
  private processRunsInterval: NodeJS.Timeout | undefined;
  private workflows: Map<string, Workflow<any, any>>;
  private stateDriver: InMemoryStateDriver;

  constructor(
    state: InMemoryStateDriver,
    workflows: Map<string, Workflow<any, any>>
  ) {
    super(state);
    this.stateDriver = state;
    this.workflows = workflows;
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
        (ctx, workflow: Workflow<any, any>) => this.execute(workflow, ctx),
        workflow,
        run.ctx
      ).finally(() => {
        this.stateDriver.endRun(run.ctx.runId);
      });
    }
  }
}
