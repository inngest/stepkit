import { BaseExeDriver } from "./exeDriver";
import { Workflow } from "./workflow";
import type { HandlerContext } from "./workflow";

export class OWClient {
  private readonly driver: BaseExeDriver;

  constructor({ driver }: { driver: BaseExeDriver }) {
    this.driver = driver;
  }

  createWorkflow<TOutput>(workflow: {
    id: string;
    handler: (ctx: HandlerContext) => Promise<TOutput>;
  }): Workflow<TOutput> {
    return new Workflow({
      id: workflow.id,
      handler: workflow.handler,
    });
  }
}
