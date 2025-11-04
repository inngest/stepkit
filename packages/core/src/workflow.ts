import type { ExecutionDriver } from "./executionDriver";
import type {
  Context,
  ExtDefault,
  InputDefault,
  Step,
  StripStandardSchema,
} from "./types";

export class Workflow<
  TInput extends InputDefault = InputDefault,
  TOutput = unknown,
  TCtxExt extends ExtDefault = ExtDefault,
  TStepExt extends ExtDefault = ExtDefault,
> {
  readonly driver: ExecutionDriver<TCtxExt, TStepExt>;
  readonly id: string;
  readonly handler: (
    ctx: Context<TInput, TCtxExt>,
    step: Step<TStepExt>
  ) => Promise<TOutput>;
  readonly maxAttempts: number;
  readonly inputSchema?: TInput;

  constructor({
    driver,
    handler,
    id,
    maxAttempts = 4,
    inputSchema: schema,
  }: {
    driver: ExecutionDriver<TCtxExt, TStepExt>;
    handler: (
      ctx: Context<TInput, TCtxExt>,
      step: Step<TStepExt>
    ) => Promise<TOutput>;
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
