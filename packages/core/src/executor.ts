import { FlowControl, type WorkflowDriver } from "./driver.js";
import type {
  ExecutionResult,
  FoundStep,
  MaybePromise,
  MemoizedOp,
  OutgoingOp,
  StepOpCode,
  StepOptions,
  StepTools,
  WorkflowContext,
  WorkflowExecutionOptions,
  WorkflowHandler,
} from "./types.js";
import {
  createDeferredPromise,
  createDeferredPromiseWithStack,
  hashId,
  runAsPromise,
} from "./utils.js";

const STEP_INDEXING_SUFFIX = ":";

type Checkpoint =
  | { type: "steps-found"; steps: FoundStep[] }
  | { type: "function-resolved"; data: unknown }
  | { type: "function-rejected"; error: unknown };

interface ExecutionState {
  stepState: Record<string, MemoizedOp>;
  stepsToFulfill: number;
  steps: Map<string, FoundStep>;
  stepCompletionOrder: string[];
  remainingStepsToBeSeen: Set<string>;
  loop: AsyncGenerator<Checkpoint, void, void>;
  setCheckpoint: (checkpoint: Checkpoint) => void;
  allStateUsed: () => boolean;
}

export class WorkflowExecutor<TInput = unknown, TOutput = unknown> {
  private state: ExecutionState;
  private options: WorkflowExecutionOptions<TInput>;
  private handler: WorkflowHandler<TInput, TOutput>;
  private driver: WorkflowDriver;
  private execution?: Promise<ExecutionResult>;

  constructor(
    options: WorkflowExecutionOptions<TInput>,
    handler: WorkflowHandler<TInput, TOutput>,
    driver: WorkflowDriver,
  ) {
    this.options = options;
    this.handler = handler;
    this.driver = driver;
    this.state = this.createExecutionState();
  }

  async start(): Promise<ExecutionResult> {
    if (this.execution) {
      return this.execution;
    }

    this.execution = this._start();
    return this.execution;
  }

  private async _start(): Promise<ExecutionResult> {
    try {
      await this.startExecution();

      for await (const checkpoint of this.state.loop) {
        const result = await this.handleCheckpoint(checkpoint);
        if (result) {
          return result;
        }
      }

      throw new Error("Core loop finished without returning a value");
    } catch (error) {
      return await this.driver.onWorkflowError(this.options, error);
    } finally {
      void this.state.loop.return();
    }
  }

  private async handleCheckpoint(
    checkpoint: Checkpoint,
  ): Promise<ExecutionResult | undefined> {
    switch (checkpoint.type) {
      case "function-resolved":
        return await this.driver.onWorkflowCompleted(
          this.options,
          checkpoint.data,
        );

      case "function-rejected":
        return await this.driver.onWorkflowError(
          this.options,
          checkpoint.error,
        );

      case "steps-found": {
        const stepResult = await this.tryExecuteStep(checkpoint.steps);
        if (stepResult) {
          const flowControl = await this.driver.onStepExecuted(
            this.options,
            stepResult,
            this.getOps(),
          );

          if (
            flowControl.action === FlowControl.Interrupt &&
            flowControl.result
          ) {
            return flowControl.result;
          }
        }

        const newSteps = this.filterNewSteps(checkpoint.steps);
        if (newSteps.length > 0) {
          const flowControl = await this.driver.onStepsFound(
            this.options,
            checkpoint.steps,
            this.getOps(),
          );

          if (
            flowControl.action === FlowControl.Interrupt &&
            flowControl.result
          ) {
            return flowControl.result;
          }
        }

        return undefined;
      }
    }
  }

  private async tryExecuteStep(
    steps: FoundStep[],
  ): Promise<OutgoingOp | undefined> {
    const hashedStepIdToRun =
      this.options.requestedRunStep || this.getEarlyExecRunStep(steps);
    if (!hashedStepIdToRun) {
      return undefined;
    }

    const step = steps.find((s) => s.hashedId === hashedStepIdToRun && s.fn);
    if (!step) {
      return undefined;
    }

    return await this.executeStep(step);
  }

  private getEarlyExecRunStep(steps: FoundStep[]): string | undefined {
    if (this.options.disableImmediateExecution) {
      return undefined;
    }

    const unfulfilledSteps = steps.filter((step) => !step.fulfilled);
    if (unfulfilledSteps.length !== 1) {
      return undefined;
    }

    return unfulfilledSteps[0]?.hashedId;
  }

  private filterNewSteps(foundSteps: FoundStep[]): FoundStep[] {
    if (this.options.requestedRunStep) {
      return [];
    }

    return foundSteps.filter((step) => !step.fulfilled);
  }

  private async executeStep(step: FoundStep): Promise<OutgoingOp> {
    const outgoingOp: OutgoingOp = {
      id: step.hashedId,
      op: step.op,
      name: step.name,
      displayName: step.displayName,
      opts: step.opts,
    };

    if (!step.fn) {
      throw new Error(`Step ${step.id} has no function to execute`);
    }

    //
    // Execute the step and resolve/reject its promise based on the result
    try {
      const data = await runAsPromise(step.fn);

      //
      // Resolve the step's promise so the user's workflow code can continue
      step.resolve(data);

      return {
        ...outgoingOp,
        data,
      };
    } catch (error) {
      //
      // Reject the step's promise
      step.reject(error);

      return {
        ...outgoingOp,
        error,
      };
    }
  }

  private async startExecution(): Promise<void> {
    runAsPromise(() => {
      const ctx = this.createContext();
      return this.handler(ctx);
    })
      .then((data) => {
        this.state.setCheckpoint({ type: "function-resolved", data });
      })
      .catch((error) => {
        this.state.setCheckpoint({ type: "function-rejected", error });
      });
  }

  private createContext(): WorkflowContext<TInput> {
    const step = this.createStepTools();

    return {
      attempt: this.driver.getRunAttempt(this.options.workflowId),
      input: this.options.input,
      step,
    };
  }

  private createStepTools(): StepTools {
    const foundStepsToReport = new Map<string, FoundStep>();
    const unhandledFoundStepsToReport = new Map<string, FoundStep>();
    const expectedNextStepIndexes = new Map<string, number>();
    let foundStepsReportPromise: Promise<void> | undefined;

    const reportNextTick = () => {
      if (foundStepsReportPromise) {
        return;
      }

      foundStepsReportPromise = new Promise((resolve) =>
        setImmediate(resolve),
      ).then(() => {
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
          const steps = [...foundStepsToReport.values()];
          foundStepsToReport.clear();

          this.state.setCheckpoint({
            type: "steps-found",
            steps,
          });
        }
      });
    };

    const pushStepToReport = (step: FoundStep) => {
      foundStepsToReport.set(step.id, step);
      unhandledFoundStepsToReport.set(step.hashedId, step);
      reportNextTick();
    };

    const createStep = (
      idOrOpts: string | StepOptions,
      op: StepOpCode,
      fn?: () => Promise<unknown>,
    ): Promise<unknown> => {
      const stepOptions =
        typeof idOrOpts === "string" ? { id: idOrOpts } : idOrOpts;
      const opId = {
        id: stepOptions.id,
        displayName: stepOptions.name || stepOptions.id,
      };

      let finalId = opId.id;

      if (this.state.steps.has(finalId)) {
        const expectedNextIndex = expectedNextStepIndexes.get(finalId) ?? 1;
        for (let i = expectedNextIndex; ; i++) {
          const newId = finalId + STEP_INDEXING_SUFFIX + i;
          if (!this.state.steps.has(newId)) {
            expectedNextStepIndexes.set(finalId, i + 1);
            finalId = newId;
            break;
          }
        }
      }

      const { promise, resolve, reject } = createDeferredPromise();
      const hashedId = hashId(finalId);
      const stepState = this.state.stepState[hashedId];
      let isFulfilled = false;

      if (stepState) {
        stepState.seen = true;
        this.state.remainingStepsToBeSeen.delete(hashedId);
        isFulfilled = true;
      }

      const step: FoundStep = {
        id: finalId,
        hashedId,
        op,
        name: opId.displayName,
        displayName: opId.displayName,
        fn,
        promise,
        resolve,
        reject,
        fulfilled: isFulfilled,
        hasStepState: Boolean(stepState),
        handled: false,
        handle: () => {
          if (step.handled) {
            return false;
          }

          step.handled = true;

          if (isFulfilled && stepState) {
            stepState.fulfilled = true;

            void Promise.resolve().then(() => {
              if (typeof stepState.data !== "undefined") {
                resolve(stepState.data);
              } else if (typeof stepState.error !== "undefined") {
                reject(stepState.error);
              }
            });
          }

          return true;
        },
      };

      this.state.steps.set(finalId, step);
      pushStepToReport(step);

      return promise;
    };

    return {
      run: <T>(
        idOrOpts: string | StepOptions,
        fn: () => MaybePromise<T>,
      ): Promise<T> => {
        const wrappedFn = async () => await fn();
        return createStep(
          idOrOpts,
          "StepPlanned" as StepOpCode,
          wrappedFn,
        ) as Promise<T>;
      },
      sleep: (
        idOrOpts: string | StepOptions,
        duration: number,
      ): Promise<void> => {
        const fn = async () =>
          new Promise<void>((resolve) => {
            setTimeout(resolve, duration);
          });
        return createStep(idOrOpts, "Sleep" as StepOpCode, fn) as Promise<void>;
      },
    };
  }

  private createExecutionState(): ExecutionState {
    const d = createDeferredPromiseWithStack<Checkpoint>();
    let checkpointResolve = d.deferred.resolve;
    const checkpointResults = d.results;

    const loop: ExecutionState["loop"] = (async function* (
      cleanUp?: () => void,
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
      void checkpointResults.return();
    });

    const stepsToFulfill = Object.keys(this.options.stepState).length;

    return {
      stepState: this.options.stepState,
      stepsToFulfill,
      steps: new Map(),
      stepCompletionOrder: [...this.options.stepCompletionOrder],
      remainingStepsToBeSeen: new Set(this.options.stepCompletionOrder),
      loop,
      setCheckpoint: (checkpoint: Checkpoint) => {
        ({ resolve: checkpointResolve } = checkpointResolve(checkpoint));
      },
      allStateUsed: () => {
        return this.state.remainingStepsToBeSeen.size === 0;
      },
    };
  }

  private getOps(): Record<string, MemoizedOp> {
    return Object.fromEntries(this.state.steps);
  }
}
