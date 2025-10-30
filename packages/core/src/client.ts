import type { WorkflowDriver } from "./driver.js";
import type { WorkflowHandler } from "./types.js";
import { Workflow, type WorkflowConfig } from "./workflow.js";

export class WorkflowClient {
  private driver: WorkflowDriver;

  constructor(driver: WorkflowDriver) {
    this.driver = driver;
  }

  workflow<TInput = unknown, TOutput = unknown>(
    config: WorkflowConfig,
    handler: WorkflowHandler<TInput, TOutput>,
  ): Workflow<TInput, TOutput> {
    return new Workflow(config, handler, this.driver);
  }
}
