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

  constructor({
    driver,
    id,
    handler,
  }: {
    driver: ExecutionDriver<TContext, TStep>;
    id: string;
    handler: (ctx: TContext, step: TStep) => Promise<TOutput>;
  }) {
    this.driver = driver;
    this.id = id;
    this.handler = handler;
  }

  async invoke(_input: unknown): Promise<TOutput> {
    return this.driver.invoke(this);
  }
}
