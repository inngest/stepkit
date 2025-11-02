import type { ExecutionDriver } from "./executionDriver";
import { Workflow } from "./workflow";
import type { StdContext, StdStep } from "./types";

export class StepKitClient<TContext extends StdContext, TStep extends StdStep> {
  private readonly driver: ExecutionDriver<TContext, TStep>;

  constructor({ driver }: { driver: ExecutionDriver<TContext, TStep> }) {
    this.driver = driver;
  }

  workflow<TOutput>(
    opts: {
      id: string;
    },
    handler: (ctx: TContext, step: TStep) => Promise<TOutput>
  ): Workflow<TContext, TStep, TOutput> {
    return new Workflow<TContext, TStep, TOutput>({
      driver: this.driver,
      id: opts.id,
      handler,
    });
  }
}
