import type { ExecutionDriver } from "./executionDriver";
import type { StdContext, StdStep } from "./types";
import { Workflow } from "./workflow";

export class StepKitClient<TContext extends StdContext, TStep extends StdStep> {
  private readonly driver: ExecutionDriver<TContext, TStep>;

  constructor({ driver }: { driver: ExecutionDriver<TContext, TStep> }) {
    this.driver = driver;
  }

  workflow<TOutput>(
    opts: {
      id: string;
      maxAttempts?: number;
    },
    handler: (ctx: TContext, step: TStep) => Promise<TOutput>
  ): Workflow<TContext, TStep, TOutput> {
    return new Workflow<TContext, TStep, TOutput>({
      ...opts,
      driver: this.driver,
      handler,
    });
  }
}
