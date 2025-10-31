import type { Workflow } from "@open-workflow/core";
import crypto from "crypto";
import { InMemoryDriver } from "./drivers";

export class InMemoryOrchestrator {
  private activeRuns: Set<string>;
  readonly driver: InMemoryDriver;

  constructor() {
    this.activeRuns = new Set();
    this.driver = new InMemoryDriver();
  }

  async invoke<TOutput>(workflow: Workflow<any, TOutput>): Promise<TOutput> {
    const runId = crypto.randomUUID();
    this.activeRuns.add(runId);

    let i = 0;
    let maxIterations = 10_000;
    while (true) {
      i++;
      if (i > maxIterations) {
        throw new Error("unreachable: infinite loop detected");
      }

      const ops = await this.driver.execute(workflow);
      if (ops.length !== 1) {
        // Not done yet
        continue;
      }
      const op = ops[0];
      if (op.config.code !== "workflow") {
        // Not done yet
        continue;
      }

      if (op.result.status !== "success") {
        throw op.result.error;
      }

      // @ts-expect-error
      return op.result.output;
    }
  }
}
