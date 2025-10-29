import type { HashedOp } from "./types";

export interface FoundStep extends HashedOp {
  hashedId: string;
  fn?: (...args: unknown[]) => unknown;
  rawArgs: unknown[];

  /**
   * A boolean representing whether the step has been fulfilled, either
   * resolving or rejecting the `Promise` returned to userland code.
   *
   * Note that this is distinct from {@link hasStepState}, which instead tracks
   * whether the step has been given some state from the Executor. State from
   * the Executor could be data other than a resolution or rejection, such as
   * inputs.
   */
  fulfilled: boolean;

  /**
   * A boolean representing whether the step has been given some state from the
   * Executor. State from the Executor could be data other than a resolution or
   * rejection, such as inputs.
   *
   * This is distinct from {@link fulfilled}, which instead tracks whether the
   * step has been fulfilled, either resolving or rejecting the `Promise`
   * returned to userland code.
   */
  hasStepState: boolean;

  handled: boolean;

  /**
   * The promise that has been returned to userland code for this step.
   */
  promise: Promise<unknown>;

  /**
   * Returns a boolean representing whether or not the step was handled on this
   * invocation.
   */
  handle: () => boolean;

  // TODO This is used to track the input we want for this step. Might be
  // present in ctx from Executor.
  input?: unknown;
}

export const STEP_INDEXING_SUFFIX = ":";

// TODO
type MatchOpFn = any;

export type StepHandler = (info: {
  matchOp: MatchOpFn;
  opts?: StepToolOptions;
  args: [string, ...unknown[]];
}) => Promise<unknown>;

export interface StepToolOptions<
  T extends (...args: unknown[]) => Promise<unknown> = (
    ...args: unknown[]
  ) => Promise<unknown>
> {
  /**
   * Optionally, we can also provide a function that will be called when
   * Inngest tells us to run this operation.
   *
   * If this function is defined, the first time the tool is used it will
   * report the desired operation (including options) to the Inngest. Inngest
   * will then call back to the function to tell it to run the step and then
   * retrieve data.
   *
   * We do this in order to allow functionality such as per-step retries; this
   * gives the SDK the opportunity to tell Inngest what it wants to do before
   * it does it.
   *
   * This function is passed the arguments passed by the user. It will be run
   * when we receive an operation matching this one that does not contain a
   * `data` property.
   */
  fn?: (...args: Parameters<T>) => unknown;
}
