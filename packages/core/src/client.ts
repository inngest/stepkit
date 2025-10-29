import { type BaseExeDriver } from './exeDriver';
import { Workflow } from './workflow';
import type { HandlerContext } from './workflow';

export class OWClient {
  private readonly driver: BaseExeDriver;

  constructor({ driver }: { driver: BaseExeDriver }) {
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
