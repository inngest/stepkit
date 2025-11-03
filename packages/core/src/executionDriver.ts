import { fromJsonError, toJsonError } from "./errors";
import { findOps, type ReportOp } from "./findOps";
import { createControlledPromise } from "./promises";
import type { StateDriver } from "./stateDriver";
import {
  controlFlow,
  StdOpCode,
  type ControlFlow,
  type OpConfig,
  type OpFound,
  type OpResult,
  type StdContext,
  type StdStep,
} from "./types";
import { ensureAsync, type HashId } from "./utils";
import type { Workflow } from "./workflow";

export type ExecutionDriver<
  TContext extends StdContext<any>,
  TStep extends StdStep,
> = {
  invoke: <TInput extends Record<string, unknown>, TOutput>(
    workflow: Workflow<TInput, TOutput, TContext, TStep>,
    input: TInput
  ) => Promise<TOutput>;
};

export function createStdStep(hash: HashId, reportOp: ReportOp): StdStep {
  return {
    run: async <TStepRunOutput>(
      stepId: string,
      handler: (() => Promise<TStepRunOutput>) | (() => TStepRunOutput)
    ): Promise<TStepRunOutput> => {
      return createOpFound(
        hash,
        reportOp,
        stepId,
        { code: StdOpCode.run },
        handler
      );
    },
    sleep: async (stepId: string, duration: number) => {
      return createOpFound(hash, reportOp, stepId, {
        code: StdOpCode.sleep,
        options: { wakeupAt: new Date(Date.now() + duration) },
      });
    },
  };
}

/**
 * Concrete execution driver implementation. Can be extended.
 */
export class BaseExecutionDriver<
  TContext extends StdContext<any> = StdContext<any>,
  TStep extends StdStep = StdStep,
> implements ExecutionDriver<TContext, TStep>
{
  constructor(public state: StateDriver) {
    this.state = state;
  }

  async execute<TInput extends Record<string, unknown>, TOutput>(
    workflow: Workflow<TInput, TOutput, TContext, TStep>,
    ctx: TContext
  ): Promise<OpResult[]> {
    return findOps<TContext, TStep, TOutput>({
      ctx,
      getSteps: (reportOp) => this.getSteps(reportOp),
      onStepsFound: (ops) => this.onStepsFound(workflow, ctx, ops),
      onWorkflowResult: (op) => this.onWorkflowResult(workflow, ctx, op),
      workflow,
    });
  }

  async getSteps(_reportOp: ReportOp): Promise<TStep> {
    throw new Error("not implemented");
  }

  async invoke<TInput extends Record<string, unknown>, TOutput>(
    _workflow: Workflow<TInput, TOutput, TContext, TStep>,
    _input: TInput
  ): Promise<TOutput> {
    throw new Error("not implemented");
  }

  onStepsFound = async (
    workflow: Workflow<any, any, TContext, TStep>,
    ctx: TContext,
    ops: OpFound[]
  ): Promise<ControlFlow> => {
    const newOps = handleExistingOps(this.state, ctx, ops);

    return await createOpResults(this.state, workflow, ctx, newOps);
  };

  onWorkflowResult = async (
    workflow: Workflow<any, any, TContext, TStep>,
    ctx: TContext,
    op: OpResult
  ): Promise<OpResult> => {
    if (op.result.status === "error") {
      op = {
        ...op,
        result: {
          ...op.result,
          canRetry: ctx.attempt + 1 < workflow.maxAttempts,
        },
      };
    }

    this.state.setOp({ runId: ctx.runId, hashedOpId: op.id.hashed }, op);
    return op;
  };
}

/**
 * Handle ops that have already been found. Return the new ops.
 */
export function handleExistingOps(
  state: StateDriver,
  ctx: StdContext,
  ops: OpFound[]
): OpFound[] {
  const newOps: OpFound[] = [];
  for (const op of ops) {
    const item = state.getOp({ runId: ctx.runId, hashedOpId: op.id.hashed });
    if (item !== undefined) {
      if (item.result.status === "success") {
        // Op already succeeded, so return its output
        op.promise.resolve(item.result.output);
      } else {
        // Op already failed, so throw its error
        op.promise.reject(fromJsonError(item.result.error));
      }
    } else {
      // Op found for the first time
      newOps.push(op);
    }
  }
  return newOps;
}

export async function createOpFound<TOutput>(
  hash: HashId,
  reportOp: ReportOp,
  id: string,
  config: OpConfig,
  handler?: (() => Promise<TOutput>) | (() => TOutput)
): Promise<TOutput> {
  if (handler !== undefined) {
    handler = ensureAsync(handler);
  }

  // TODO: Increment index when op is found multiple times
  const index = 0;

  return await reportOp<TOutput>({
    config,
    handler,
    id: { hashed: hash(id, index), id, index },
    promise: createControlledPromise<TOutput>(),
  });
}

export async function createOpResults<
  TContext extends StdContext,
  TStep extends StdStep,
  TOutput,
>(
  state: StateDriver,
  workflow: Workflow<any, any, TContext, TStep>,
  ctx: StdContext,
  ops: OpFound<OpConfig, TOutput>[]
): Promise<ControlFlow> {
  const opResults: OpResult[] = [];
  for (const op of ops) {
    const opResult: OpResult = {
      config: op.config,
      id: op.id,
      result: { status: "success", output: undefined },
    };

    if (op.handler !== undefined) {
      // Dynamic op
      try {
        const output = await op.handler();
        opResult.result = { status: "success", output };
      } catch (e) {
        opResult.result = {
          status: "error",
          error: toJsonError(e),
          canRetry: ctx.attempt + 1 < workflow.maxAttempts,
        };
      }
    }

    state.setOp({ runId: ctx.runId, hashedOpId: op.id.hashed }, opResult);
    opResults.push(opResult);
  }

  if (opResults.length === 0) {
    return controlFlow.continue();
  }

  return controlFlow.interrupt(opResults);
}
