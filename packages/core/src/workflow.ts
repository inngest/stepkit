import type { z } from "zod";

import type { ExecutionDriver } from "./executionDriver";
import type { StdContext, StdStep } from "./types";

export class Workflow<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
  TContext extends StdContext<TInput> = StdContext<TInput>,
  TStep extends StdStep = StdStep,
> {
  readonly driver: ExecutionDriver<TContext, TStep>;
  readonly id: string;
  readonly handler: (ctx: TContext, step: TStep) => Promise<TOutput>;
  readonly maxAttempts: number;
  readonly schema?: z.ZodType<TInput>;

  constructor({
    driver,
    handler,
    id,
    maxAttempts = 4,
    schema,
  }: {
    driver: ExecutionDriver<TContext, TStep>;
    handler: (ctx: TContext, step: TStep) => Promise<TOutput>;
    id: string;
    maxAttempts?: number;
    schema?: z.ZodType<TInput>;
  }) {
    this.driver = driver;
    this.id = id;
    this.handler = handler;
    this.maxAttempts = maxAttempts;
    this.schema = schema;
  }

  async invoke(input: TInput): Promise<TOutput> {
    return this.driver.invoke(this, input);
  }
}
