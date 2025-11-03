import type { ExecutionDriver } from "./executionDriver";
import type {
  InputDefault,
  StdContext,
  StdStep,
  StripStandardSchema,
} from "./types";

export class Workflow<
  TInput extends InputDefault = InputDefault,
  TOutput = unknown,
  TContext extends StdContext<TInput> = StdContext<TInput>,
  TStep extends StdStep = StdStep,
> {
  readonly driver: ExecutionDriver<TContext, TStep>;
  readonly id: string;
  readonly handler: (ctx: TContext, step: TStep) => Promise<TOutput>;
  readonly maxAttempts: number;
  readonly inputSchema?: TInput;

  constructor({
    driver,
    handler,
    id,
    maxAttempts = 4,
    inputSchema: schema,
  }: {
    driver: ExecutionDriver<TContext, TStep>;
    handler: (ctx: TContext, step: TStep) => Promise<TOutput>;
    id: string;
    maxAttempts?: number;
    inputSchema?: TInput;
  }) {
    this.driver = driver;
    this.id = id;
    this.handler = handler;
    this.maxAttempts = maxAttempts;
    this.inputSchema = schema;
  }

  async invoke(input: StripStandardSchema<TInput>): Promise<TOutput> {
    return this.driver.invoke(this, input);
  }
}
