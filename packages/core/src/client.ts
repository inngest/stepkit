import { ExecutionDriver } from "./executionDriver";
import { Workflow } from "./workflow";
import { StdContext } from "./types";

export class OWClient<TContext extends StdContext> {
  private readonly driver: ExecutionDriver<TContext>;

  constructor({ driver }: { driver: ExecutionDriver<TContext> }) {
    this.driver = driver;
  }

  workflow<TOutput>(
    opts: {
      id: string;
    },
    handler: (ctx: TContext) => Promise<TOutput>
  ): Workflow<TContext, TOutput> {
    return new Workflow<TContext, TOutput>({
      driver: this.driver,
      id: opts.id,
      handler,
    });
  }
}
