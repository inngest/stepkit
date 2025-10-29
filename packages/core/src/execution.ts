import hashjs from "hash.js";
import {
  ErrCode,
  minifyPrettyError,
  prettyError,
  serializeError,
} from "../../helpers/errors.js";
import { undefinedToNull } from "../../helpers/functions.js";
import {
  createDeferredPromise,
  createDeferredPromiseWithStack,
  createTimeoutPromise,
  runAsPromise,
} from "../../helpers/promises.ts";
import type { MaybePromise, Simplify } from "../../helpers/types.ts";
import {
  type EventPayload,
  type Handler,
  type OutgoingOp,
  StepOpCode,
  type Context,
} from "./types";
import {
  createStepTools,
  type FoundStep,
  getStepOptions,
  STEP_INDEXING_SUFFIX,
  type StepHandler,
} from "./stepTools";
import { NonRetriableError } from "../NonRetriableError.ts";
import { RetryAfterError } from "../RetryAfterError.ts";
import { StepError } from "../StepError.ts";
import { getAsyncCtx, getAsyncLocalStorage } from "./als";
import {
  type ExecutionResult,
  type InngestExecutionOptions,
  type MemoizedOp,
} from "./InngestExecution.ts";

const { sha1 } = hashjs;

export class Execution {
  private state: V2ExecutionState;
  private fnArg: Context;
  private checkpointHandlers: CheckpointHandlers;
  private timeoutDuration = 1000 * 10;
  private execution: Promise<ExecutionResult> | undefined;
  private userFnToRun: Handler.Any;

  /**
   * If we're supposed to run a particular step via `requestedRunStep`, this
   * will be a `Promise` that resolves after no steps have been found for
   * `timeoutDuration` milliseconds.
   *
   * If we're not supposed to run a particular step, this will be `undefined`.
   */
  private timeout?: ReturnType<typeof createTimeoutPromise>;
  private options: InngestExecutionOptions;

  constructor(options: InngestExecutionOptions) {
    this.options = options;
    this.userFnToRun = this.getUserFnToRun();
    this.state = this.createExecutionState();
    this.fnArg = this.createFnArg();
    this.checkpointHandlers = this.createCheckpointHandlers();
    this.initializeTimer(this.state);
  }

  /**
   * Idempotently start the execution of the user's function.
   */
  public start() {
    if (!this.execution) {
      this.execution = getAsyncLocalStorage().then((als) => {
        return als.run({ ctx: this.fnArg }, async () => {
          return this._start().then((result) => {
            return result;
          });
        });
      });
    }

    return this.execution;
  }

  /**
   * Starts execution of the user's function and the core loop.
   */
  private async _start(): Promise<ExecutionResult> {
    try {
      const allCheckpointHandler = this.getCheckpointHandler("");
      await this.startExecution();

      for await (const checkpoint of this.state.loop) {
        await allCheckpointHandler(checkpoint);

        const handler = this.getCheckpointHandler(checkpoint.type);
        const result = await handler(checkpoint);

        if (result) {
          return result;
        }
      }
    } catch (error) {
      return await this.transformOutput({ error });
    } finally {
      void this.state.loop.return();
    }

    /**
     * If we're here, the generator somehow finished without returning a value.
     * This should never happen.
     */
    throw new Error("Core loop finished without returning a value");
  }

  /**
   * Creates a handler for every checkpoint type, defining what to do when we
   * reach that checkpoint in the core loop.
   */
  private createCheckpointHandlers(): CheckpointHandlers {
    return {
      /**
       * Run for all checkpoints. Best used for logging or common actions.
       * Use other handlers to return values and interrupt the core loop.
       */
      "": (checkpoint) => {},

      /**
       * The user's function has completed and returned a value.
       */
      "function-resolved": async (checkpoint) => {
        return await this.transformOutput({ data: checkpoint.data });
      },

      /**
       * The user's function has thrown an error.
       */
      "function-rejected": async (checkpoint) => {
        return await this.transformOutput({ error: checkpoint.error });
      },

      /**
       * We've found one or more steps. Here we may want to run a step or report
       * them back to Inngest.
       */
      "steps-found": async ({ steps }) => {
        const stepResult = await this.tryExecuteStep(steps);
        if (stepResult) {
          const transformResult = await this.transformOutput(stepResult);

          /**
           * Transforming output will always return either function rejection or
           * resolution. In most cases, this can be immediately returned, but in
           * this particular case we want to handle it differently.
           */
          if (transformResult.type === "function-resolved") {
            return {
              type: "step-ran",
              ctx: transformResult.ctx,
              ops: transformResult.ops,
              step: _internals.hashOp({
                ...stepResult,
                data: transformResult.data,
              }),
            };
          } else if (transformResult.type === "function-rejected") {
            const stepForResponse = _internals.hashOp({
              ...stepResult,
              error: transformResult.error,
            });

            if (stepResult.op === StepOpCode.StepFailed) {
              const ser = serializeError(transformResult.error);
              stepForResponse.data = {
                __serialized: true,
                name: ser.name,
                message: ser.message,
                stack: "",
              };
            }

            return {
              type: "step-ran",
              ctx: transformResult.ctx,
              ops: transformResult.ops,
              retriable: transformResult.retriable,
              step: stepForResponse,
            };
          }

          return transformResult;
        }

        const newSteps = await this.filterNewSteps(
          Array.from(this.state.steps.values())
        );
        if (newSteps) {
          return {
            type: "steps-found",
            ctx: this.fnArg,
            ops: this.ops,
            steps: newSteps,
          };
        }

        return;
      },

      /**
       * While trying to find a step that Inngest has told us to run, we've
       * timed out or have otherwise decided that it doesn't exist.
       */
      "step-not-found": ({ step }) => {
        return { type: "step-not-found", ctx: this.fnArg, ops: this.ops, step };
      },
    };
  }

  private getCheckpointHandler(type: keyof CheckpointHandlers) {
    return this.checkpointHandlers[type] as (
      checkpoint: Checkpoint
    ) => MaybePromise<ExecutionResult | undefined>;
  }

  private async tryExecuteStep(
    steps: FoundStep[]
  ): Promise<OutgoingOp | undefined> {
    const hashedStepIdToRun =
      this.options.requestedRunStep || this.getEarlyExecRunStep(steps);
    if (!hashedStepIdToRun) {
      return;
    }

    const step = steps.find(
      (step) => step.hashedId === hashedStepIdToRun && step.fn
    );

    if (step) {
      return await this.executeStep(step);
    }

    /**
     * Ensure we reset the timeout if we have a requested run step but couldn't
     * find it, but also that we don't reset if we found and executed it.
     */
    return void this.timeout?.reset();
  }

  /**
   * Given a list of outgoing ops, decide if we can execute an op early and
   * return the ID of the step to execute if we can.
   */
  private getEarlyExecRunStep(steps: FoundStep[]): string | undefined {
    /**
     * We may have been disabled due to parallelism, in which case we can't
     * immediately execute unless explicitly requested.
     */
    if (this.options.disableImmediateExecution) return;

    const unfulfilledSteps = steps.filter((step) => !step.fulfilled);
    if (unfulfilledSteps.length !== 1) return;

    const op = unfulfilledSteps[0];

    if (
      op &&
      op.op === StepOpCode.StepPlanned
      // TODO We must individually check properties here that we do not want to
      // execute on, such as retry counts. Nothing exists here that falls in to
      // this case, but should be accounted for when we add them.
      // && typeof op.opts === "undefined"
    ) {
      return op.hashedId;
    }

    return;
  }

  private async filterNewSteps(
    foundSteps: FoundStep[]
  ): Promise<[OutgoingOp, ...OutgoingOp[]] | undefined> {
    if (this.options.requestedRunStep) {
      return;
    }

    /**
     * Gather any steps that aren't memoized and report them.
     */
    const newSteps = foundSteps.filter((step) => !step.fulfilled);

    if (!newSteps.length) {
      return;
    }

    /**
     * Warn if we've found new steps but haven't yet seen all previous
     * steps. This may indicate that step presence isn't determinate.
     */
    let knownSteps = 0;
    for (const step of foundSteps) {
      if (step.fulfilled) {
        knownSteps++;
      }
    }
    const foundAllCompletedSteps = this.state.stepsToFulfill === knownSteps;

    if (!foundAllCompletedSteps) {
      // TODO Tag
      console.warn(
        prettyError({
          type: "warn",
          whatHappened: "Function may be indeterminate",
          why: "We found new steps before seeing all previous steps, which may indicate that the function is non-deterministic.",
          consequences:
            "This may cause unexpected behaviour as Inngest executes your function.",
          reassurance:
            "This is expected if a function is updated in the middle of a run, but may indicate a bug if not.",
        })
      );
    }

    /**
     * We're finishing up; let's trigger the last of the hooks.
     */

    const stepList = newSteps.map<OutgoingOp>((step) => ({
      displayName: step.displayName,
      op: step.op,
      id: step.hashedId,
      name: step.name,
      opts: step.opts,
    })) as [OutgoingOp, ...OutgoingOp[]];

    /**
     * We also run `onSendEvent` middleware hooks against `step.invoke()` steps
     * to ensure that their `data` is transformed correctly.
     */
    return stepList;
  }

  private async executeStep({
    id,
    name,
    opts,
    fn,
    displayName,
  }: FoundStep): Promise<OutgoingOp> {
    this.timeout?.clear();

    const outgoingOp: OutgoingOp = {
      id,
      op: StepOpCode.StepRun,
      opts,
    };
    this.state.executingStep = outgoingOp;

    const store = await getAsyncCtx();

    if (store) {
      store.executingStep = {
        id,
        name: displayName,
      };
    }

    return runAsPromise(fn)
      .finally(async () => {
        if (store) {
          delete store.executingStep;
        }
      })
      .then<OutgoingOp>((data) => {
        return {
          ...outgoingOp,
          data,
        };
      })
      .catch<OutgoingOp>((error) => {
        let errorIsRetriable = true;

        if (error instanceof NonRetriableError) {
          errorIsRetriable = false;
        } else if (
          this.fnArg.maxAttempts &&
          this.fnArg?.maxAttempts - 1 === this.fnArg.attempt
        ) {
          errorIsRetriable = false;
        }

        if (errorIsRetriable) {
          return {
            ...outgoingOp,
            op: StepOpCode.StepError,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            error,
          };
        } else {
          return {
            ...outgoingOp,
            op: StepOpCode.StepFailed,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            error,
          };
        }
      });
  }

  /**
   * Starts execution of the user's function, including triggering checkpoints
   * and middleware hooks where appropriate.
   */
  private async startExecution(): Promise<void> {
    /**
     * Mutate input as neccessary based on middleware.
     */
    await this.transformInput();

    /**
     * Start the timer to time out the run if needed.
     */
    void this.timeout?.start();

    /**
     * If we had no state to begin with, immediately end the memoization phase.
     */
    if (this.state.allStateUsed()) {
      // Middleware was here
    }

    /**
     * Trigger the user's function.
     */
    runAsPromise(() => this.userFnToRun(this.fnArg))
      .then((data) => {
        this.state.setCheckpoint({ type: "function-resolved", data });
      })
      .catch((error) => {
        this.state.setCheckpoint({ type: "function-rejected", error });
      });
  }

  /**
   * Using middleware, transform input before running.
   */
  private async transformInput() {
    const inputMutations = {
      ctx: { ...this.fnArg },
      steps: Object.values(this.state.stepState),
    };

    if (inputMutations?.ctx) {
      this.fnArg = inputMutations.ctx;
    }

    if (inputMutations?.steps) {
      this.state.stepState = Object.fromEntries(
        inputMutations.steps.map((step) => [step.id, step])
      );
    }
  }

  /**
   * Using middleware, transform output before returning.
   */
  private async transformOutput(
    dataOrError: Readonly<Pick<OutgoingOp, "error" | "data">>
  ): Promise<ExecutionResult> {
    const output = { ...dataOrError } as Partial<OutgoingOp>;

    const isStepExecution = Boolean(this.state.executingStep);

    const transformedOutput = { result: { ...output } };

    const { data, error } = { ...output, ...transformedOutput?.result };

    if (typeof error !== "undefined") {
      /**
       * Ensure we give middleware the chance to decide on retriable behaviour
       * by looking at the error returned from output transformation.
       */
      let retriable: boolean | string = !(
        error instanceof NonRetriableError ||
        (error instanceof StepError &&
          error === this.state.recentlyRejectedStepError)
      );
      if (retriable && error instanceof RetryAfterError) {
        retriable = error.retryAfter;
      }
      const serializedError = minifyPrettyError(serializeError(error));

      return {
        type: "function-rejected",
        ctx: this.fnArg,
        ops: this.ops,
        error: serializedError,
        retriable,
      };
    }

    return {
      type: "function-resolved",
      ctx: this.fnArg,
      ops: this.ops,
      data: undefinedToNull(data),
    };
  }

  private createExecutionState(): V2ExecutionState {
    const d = createDeferredPromiseWithStack<Checkpoint>();
    let checkpointResolve = d.deferred.resolve;
    const checkpointResults = d.results;

    const loop: V2ExecutionState["loop"] = (async function* (
      cleanUp?: () => void
    ) {
      try {
        while (true) {
          const res = (await checkpointResults.next()).value;
          if (res) {
            yield res;
          }
        }
      } finally {
        cleanUp?.();
      }
    })(() => {
      this.timeout?.clear();
      void checkpointResults.return();
    });

    const stepsToFulfill = Object.keys(this.options.stepState).length;

    const state: V2ExecutionState = {
      stepState: this.options.stepState,
      stepsToFulfill,
      steps: new Map(),
      loop,
      hasSteps: Boolean(stepsToFulfill),
      stepCompletionOrder: [...this.options.stepCompletionOrder],
      remainingStepsToBeSeen: new Set(this.options.stepCompletionOrder),
      setCheckpoint: (checkpoint: Checkpoint) => {
        ({ resolve: checkpointResolve } = checkpointResolve(checkpoint));
      },
      allStateUsed: () => {
        return this.state.remainingStepsToBeSeen.size === 0;
      },
    };

    return state;
  }

  get ops(): Record<string, MemoizedOp> {
    return Object.fromEntries(this.state.steps);
  }

  private createFnArg(): Context {
    const step = this.createStepTools();

    let fnArg = {
      ...(this.options.data as { event: EventPayload }),
      step,
    } as Context;

    return this.options.transformCtx?.(fnArg) ?? fnArg;
  }

  private createStepTools(): ReturnType<typeof createStepTools> {
    /**
     * A list of steps that have been found and are being rolled up before being
     * reported to the core loop.
     */
    const foundStepsToReport: Map<string, FoundStep> = new Map();

    /**
     * A map of the subset of found steps to report that have not yet been
     * handled. Used for fast access to steps that need to be handled in order.
     */
    const unhandledFoundStepsToReport: Map<string, FoundStep> = new Map();

    /**
     * A map of the latest sequential step indexes found for each step ID. Used
     * to ensure that we don't index steps in parallel.
     *
     * Note that these must be sequential; if we've seen or assigned `a:1`,
     * `a:2` and `a:4`, the latest sequential step index is `2`.
     *
     */
    const expectedNextStepIndexes: Map<string, number> = new Map();

    /**
     * A promise that's used to ensure that step reporting cannot be run more than
     * once in a given asynchronous time span.
     */
    let foundStepsReportPromise: Promise<void> | undefined;

    /**
     * A promise that's used to represent middleware hooks running before
     * execution.
     */
    let beforeExecHooksPromise: Promise<void> | undefined;

    /**
     * A helper used to report steps to the core loop. Used after adding an item
     * to `foundStepsToReport`.
     */
    const reportNextTick = () => {
      // Being explicit instead of using `??=` to appease TypeScript.
      if (foundStepsReportPromise) {
        return;
      }

      foundStepsReportPromise = new Promise((resolve) => setImmediate(resolve))
        /**
         * Ensure that we wait for this promise to resolve before continuing.
         *
         * The groups in which steps are reported can affect how we detect some
         * more complex determinism issues like parallel indexing. This promise
         * can represent middleware hooks being run early, in the middle of
         * ingesting steps to report.
         *
         * Because of this, it's important we wait for this middleware to resolve
         * before continuing to report steps to ensure that all steps have a
         * chance to be reported throughout this asynchronous action.
         */
        .then(() => beforeExecHooksPromise)
        .then(() => {
          foundStepsReportPromise = undefined;

          for (const [hashedId, step] of unhandledFoundStepsToReport) {
            if (step.handle()) {
              unhandledFoundStepsToReport.delete(hashedId);
              if (step.fulfilled) {
                foundStepsToReport.delete(step.id);
              }
            }
          }

          if (foundStepsToReport.size) {
            const steps = [...foundStepsToReport.values()] as [
              FoundStep,
              ...FoundStep[]
            ];

            foundStepsToReport.clear();

            return void this.state.setCheckpoint({
              type: "steps-found",
              steps: steps,
            });
          }
        });
    };

    /**
     * A helper used to push a step to the list of steps to report.
     */
    const pushStepToReport = (step: FoundStep) => {
      foundStepsToReport.set(step.id, step);
      unhandledFoundStepsToReport.set(step.hashedId, step);
      reportNextTick();
    };

    const stepHandler: StepHandler = async ({
      args,
      matchOp,
      opts,
    }): Promise<unknown> => {
      await beforeExecHooksPromise;

      const stepOptions = getStepOptions(args[0]);
      const opId = matchOp(stepOptions, ...args.slice(1));

      if (this.state.executingStep) {
        /**
         * If a step is found after asynchronous actions during another step's
         * execution, everything is fine. The problem here is if we've found
         * that a step nested inside another a step, which is something we don't
         * support at the time of writing.
         *
         * In this case, we could use something like Async Hooks to understand
         * how the step is being triggered, though this isn't available in all
         * environments.
         *
         * Therefore, we'll only show a warning here to indicate that this is
         * potentially an issue.
         */
        console.warn(
          prettyError({
            whatHappened: `We detected that you have nested \`step.*\` tooling in \`${
              opId.displayName ?? opId.id
            }\``,
            consequences: "Nesting `step.*` tooling is not supported.",
            type: "warn",
            reassurance:
              "It's possible to see this warning if steps are separated by regular asynchronous calls, which is fine.",
            stack: true,
            toFixNow:
              "Make sure you're not using `step.*` tooling inside of other `step.*` tooling. If you need to compose steps together, you can create a new async function and call it from within your step function, or use promise chaining.",
            code: ErrCode.NESTING_STEPS,
          })
        );
      }

      if (this.state.steps.has(opId.id)) {
        const originalId = opId.id;

        const expectedNextIndex = expectedNextStepIndexes.get(originalId) ?? 1;
        for (let i = expectedNextIndex; ; i++) {
          const newId = originalId + STEP_INDEXING_SUFFIX + i;

          if (!this.state.steps.has(newId)) {
            expectedNextStepIndexes.set(originalId, i + 1);
            opId.id = newId;
            break;
          }
        }
      }

      const { promise, resolve, reject } = createDeferredPromise();
      const hashedId = _internals.hashId(opId.id);
      const stepState = this.state.stepState[hashedId];
      let isFulfilled = false;
      if (stepState) {
        stepState.seen = true;
        this.state.remainingStepsToBeSeen.delete(hashedId);

        if (typeof stepState.input === "undefined") {
          isFulfilled = true;
        }
      }

      let extraOpts: Record<string, unknown> | undefined;
      let fnArgs = [...args];

      if (
        typeof stepState?.input !== "undefined" &&
        Array.isArray(stepState.input)
      ) {
        switch (opId.op) {
          // `step.run()` has its function input affected
          case StepOpCode.StepPlanned: {
            fnArgs = [...args.slice(0, 2), ...stepState.input];

            extraOpts = { input: [...stepState.input] };
            break;
          }

          // `step.ai.infer()` has its body affected
          case StepOpCode.AiGateway: {
            extraOpts = {
              body: {
                ...(typeof opId.opts?.body === "object"
                  ? { ...opId.opts.body }
                  : {}),
                ...stepState.input[0],
              },
            };
            break;
          }
        }
      }

      const step: FoundStep = {
        ...opId,
        opts: { ...opId.opts, ...extraOpts },
        rawArgs: fnArgs, // TODO What is the right value here? Should this be raw args without affected input?
        hashedId,
        input: stepState?.input,

        fn: opts?.fn ? () => opts.fn?.(...fnArgs) : undefined,
        promise,
        fulfilled: isFulfilled,
        hasStepState: Boolean(stepState),
        displayName: opId.displayName ?? opId.id,
        handled: false,
        handle: () => {
          if (step.handled) {
            return false;
          }

          step.handled = true;

          if (isFulfilled && stepState) {
            stepState.fulfilled = true;

            // For some execution scenarios such as testing, `data`, `error`,
            // and `input` may be `Promises`. This could also be the case for
            // future middleware applications. For this reason, we'll make sure
            // the values are fully resolved before continuing.
            void Promise.all([
              stepState.data,
              stepState.error,
              stepState.input,
            ]).then(() => {
              if (typeof stepState.data !== "undefined") {
                resolve(stepState.data);
              } else {
                this.state.recentlyRejectedStepError = new StepError(
                  opId.id,
                  stepState.error
                );
                reject(this.state.recentlyRejectedStepError);
              }
            });
          }

          return true;
        },
      };

      this.state.steps.set(opId.id, step);
      this.state.hasSteps = true;
      pushStepToReport(step);

      return promise;
    };

    return createStepTools(this.options.client, this, stepHandler);
  }

  private getUserFnToRun(): Handler.Any {
    if (!this.options.isFailureHandler) {
      return this.options.fn["fn"];
    }

    if (!this.options.fn["onFailureFn"]) {
      /**
       * Somehow, we've ended up detecting that this is a failure handler but
       * doesn't have an `onFailure` function. This should never happen.
       */
      throw new Error("Cannot find function `onFailure` handler");
    }

    return this.options.fn["onFailureFn"];
  }

  private initializeTimer(state: V2ExecutionState): void {
    if (!this.options.requestedRunStep) {
      return;
    }

    this.timeout = createTimeoutPromise(this.timeoutDuration);

    void this.timeout.then(async () => {
      state.setCheckpoint({
        type: "step-not-found",
        step: {
          id: this.options.requestedRunStep as string,
          op: StepOpCode.StepNotFound,
        },
      });
    });
  }
}

/**
 * Types of checkpoints that can be reached during execution.
 */
export interface Checkpoints {
  "steps-found": { steps: [FoundStep, ...FoundStep[]] };
  "function-rejected": { error: unknown };
  "function-resolved": { data: unknown };
  "step-not-found": { step: OutgoingOp };
}

type Checkpoint = {
  [K in keyof Checkpoints]: Simplify<{ type: K } & Checkpoints[K]>;
}[keyof Checkpoints];

type CheckpointHandlers = {
  [C in Checkpoint as C["type"]]: (
    checkpoint: C
  ) => MaybePromise<ExecutionResult | undefined>;
} & {
  "": (checkpoint: Checkpoint) => MaybePromise<void>;
};

export interface V2ExecutionState {
  /**
   * A value that indicates that we're executing this step. Can be used to
   * ensure steps are not accidentally nested until we support this across all
   * platforms.
   */
  executingStep?: Readonly<Omit<OutgoingOp, "id">>;

  /**
   * A map of step IDs to their data, used to fill previously-completed steps
   * with state from the executor.
   */
  stepState: Record<string, MemoizedOp>;

  /**
   * The number of steps we expect to fulfil based on the state passed from the
   * Executor.
   */
  stepsToFulfill: number;

  /**
   * A map of step IDs to their functions to run. The executor can request a
   * specific step to run, so we need to store the function to run here.
   */
  steps: Map<string, FoundStep>;

  /**
   * A flag which represents whether or not steps are understood to be used in
   * this function. This is used to determine whether or not we should run
   * some steps (such as `step.sendEvent`) inline as they are found.
   */
  hasSteps: boolean;

  /**
   * The core loop - a generator used to take an action upon finding the next
   * checkpoint. Manages the flow of execution and cleaning up after itself.
   */
  loop: AsyncGenerator<Checkpoint, void, void>;

  /**
   * A function that resolves the `Promise` returned by `waitForNextDecision`.
   */
  setCheckpoint: (data: Checkpoint) => void;

  /**
   * Returns whether or not all state passed from the executor has been used to
   * fulfill found steps.
   */
  allStateUsed: () => boolean;

  /**
   * An ordered list of step IDs that represents the order in which their
   * execution was completed.
   */
  stepCompletionOrder: string[];

  /**
   * An set of step IDs that have yet to be seen in this execution. Used to
   * decide when to trigger middleware based on the current state.
   */
  remainingStepsToBeSeen: Set<string>;

  /**
   * If defined, this is the error that purposefully thrown when memoizing step
   * state in order to support per-step errors.
   *
   * We use this so that if the function itself rejects with the same error, we
   * know that it was entirely uncaught (or at the very least rethrown), so we
   * should send a `NonRetriableError` to stop needless execution of a function
   * that will continue to fail.
   *
   * TODO This is imperfect, as this state is currently kept around for longer
   * than it needs to be. It should disappear as soon as we've seen that the
   * error did not immediately throw. It may need to be refactored to work a
   * little more smoothly with the core loop.
   */
  recentlyRejectedStepError?: StepError;
}

const hashId = (id: string): string => {
  return sha1().update(id).digest("hex");
};

const hashOp = (op: OutgoingOp): OutgoingOp => {
  return {
    ...op,
    id: hashId(op.id),
  };
};

/**
 * Exported for testing.
 */
export const _internals = { hashOp, hashId };
