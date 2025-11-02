import type { ExecutionDriver } from "./executionDriver";
import type { StdContext, StdStep } from "./types";

export class Workflow<
  TContext extends StdContext,
  TStep extends StdStep,
  TOutput,
> {
  driver: ExecutionDriver<TContext, TStep>;
  id: string;
  public readonly handler: (ctx: TContext, step: TStep) => Promise<TOutput>;
  public readonly maxAttempts: number;

  constructor({
    driver,
    handler,
    id,
    maxAttempts = 4,
  }: {
    driver: ExecutionDriver<TContext, TStep>;
    handler: (ctx: TContext, step: TStep) => Promise<TOutput>;
    id: string;
    maxAttempts?: number;
  }) {
    this.driver = driver;
    this.id = id;
    this.handler = handler;
    this.maxAttempts = maxAttempts;
  }

  async invoke(_input: unknown): Promise<TOutput> {
    return this.driver.invoke(this);
  }
}
