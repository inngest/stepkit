export class Workflow<TContext, TOutput> {
  id: string;
  public readonly handler: (ctx: TContext) => Promise<TOutput>;

  constructor({
    id,
    handler,
  }: {
    id: string;
    handler: (ctx: TContext) => Promise<TOutput>;
  }) {
    this.id = id;
    this.handler = handler;
  }

  async invoke(input: unknown): Promise<TOutput> {
    throw new Error("not implemented");
  }
}
