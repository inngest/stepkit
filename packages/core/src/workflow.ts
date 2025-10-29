export class Workflow<TOutput> {
  id: string;
  private readonly handler: (ctx: HandlerContext) => Promise<TOutput>;

  constructor({
    id,
    handler,
  }: {
    id: string;
    handler: (ctx: HandlerContext) => Promise<TOutput>;
  }) {
    this.id = id;
    this.handler = handler;
  }

  async invoke(input: unknown): Promise<TOutput> {
    // TODO: Implement
  }
}

type Steps = {
  run: <T>(stepId: string, handler: () => Promise<T>) => Promise<T>;
};

export type HandlerContext = {
  step: Steps;
};
