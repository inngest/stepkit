import { ExecutionDriver } from "./baseExecutionDriver/driver";
import { Workflow } from "./workflow";

export class OWClient<TContext> {
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
      id: opts.id,
      handler,
    });
  }
}
