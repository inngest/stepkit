import { type BaseExecutionDriver } from './baseExecutionDriver';
import { Workflow } from './workflow';
import type { HandlerContext } from './workflow';

export class OWClient {
  private readonly driver: BaseExecutionDriver;

  constructor({ driver }: { driver: BaseExecutionDriver }) {
    this.driver = driver;
  }

  workflow<TOutput>(
    opts: {
      id: string;
    },
    handler: (ctx: HandlerContext) => Promise<TOutput>
  ): Workflow<TOutput> {
    return new Workflow({
      id: opts.id,
      handler,
      driver: this.driver,
    });
  }
}
