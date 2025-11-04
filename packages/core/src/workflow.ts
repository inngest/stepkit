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
  TCfgExt extends ExtDefault = ExtDefault,
  TCtxExt extends ExtDefault = ExtDefault,
  TStepExt extends ExtDefault = ExtDefault,
> {
  readonly driver: ExecutionDriver<TCfgExt, TCtxExt, TStepExt>;
  readonly ext: TCfgExt | undefined;
  readonly id: string;
  readonly handler: (
    ctx: Context<TInput, TCtxExt>,
    step: Step<TStepExt>
  ) => Promise<TOutput>;
  readonly maxAttempts: number;
  readonly inputSchema?: TInput;

  constructor({
    driver,
    ext,
    handler,
    id,
    maxAttempts = 4,
    inputSchema: schema,
  }: {
    driver: ExecutionDriver<TCfgExt, TCtxExt, TStepExt>;
    ext?: TCfgExt;
    handler: (
      ctx: Context<TInput, TCtxExt>,
      step: Step<TStepExt>
    ) => Promise<TOutput>;
    id: string;
    maxAttempts?: number;
    inputSchema?: TInput;
  }) {
    this.driver = driver;
    this.ext = ext;
    this.id = id;
    this.handler = handler;
    this.maxAttempts = maxAttempts;
    this.inputSchema = schema;
  }

  async invoke(input: StripStandardSchema<TInput>): Promise<TOutput> {
    return this.driver.invoke(this, input);
  }
}
