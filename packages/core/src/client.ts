import type { ExecutionDriver } from "./executionDriver";
import type {
  InputDefault,
  OverrideContextInput,
  StdContext,
  StdStep,
} from "./types";
import { Workflow } from "./workflow";

export class StepKitClient<
  TContext extends StdContext<any>,
  TStep extends StdStep = StdStep,
> {
  private readonly driver: ExecutionDriver<TContext, TStep>;

  constructor({ driver }: { driver: ExecutionDriver<TContext, TStep> }) {
    this.driver = driver;
  }

  workflow<TInput extends InputDefault = InputDefault, TOutput = unknown>(
    opts: {
      id: string;
      maxAttempts?: number;
      inputSchema?: TInput;
    },
    handler: (
      ctx: OverrideContextInput<TContext, TInput>,
      step: TStep
    ) => Promise<TOutput>
  ): Workflow<TInput, TOutput, OverrideContextInput<TContext, TInput>, TStep> {
    return new Workflow<
      TInput,
      TOutput,
      OverrideContextInput<TContext, TInput>,
      TStep
    >({
      ...opts,
      driver: this.driver,
      handler,
    });
  }
}
