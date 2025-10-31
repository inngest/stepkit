import { ExecutionDriver } from "./executionDriver";
import { StdContext } from "./types";
export class Workflow<TContext extends StdContext, TOutput> {
  driver: ExecutionDriver<TContext>;
  id: string;
  public readonly handler: (ctx: TContext) => Promise<TOutput>;

  constructor({
    driver,
    id,
    handler,
  }: {
    driver: ExecutionDriver<TContext>;
    id: string;
    handler: (ctx: TContext) => Promise<TOutput>;
  }) {
    this.driver = driver;
    this.id = id;
    this.handler = handler;
  }

  async invoke(input: unknown): Promise<TOutput> {
    return this.driver.invoke(this);
  }
}
