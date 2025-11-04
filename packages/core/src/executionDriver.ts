import { fromJsonError, InvalidInputError, toJsonError } from "./errors";
import { findOps, type ReportOp } from "./findOps";
import { createControlledPromise } from "./promises";
import type { StateDriver } from "./stateDriver";
import {
  controlFlow,
  StdOpCode,
  type Context,
  type ControlFlow,
  type InputDefault,
  type OpConfig,
  type OpFound,
  type OpResult,
  type Step,
  type StripStandardSchema,
} from "./types";
import { ensureAsync, type HashId } from "./utils";
import type { Workflow } from "./workflow";

export type ExecutionDriver<
  TContext extends Context<any>,
  TStep extends Step,
> = {
  invoke: <TInput extends InputDefault, TOutput>(
    workflow: Workflow<TInput, TOutput, TContext, TStep>,
    input: StripStandardSchema<TInput>
  ) => Promise<TOutput>;
};

export function createStdStep(hash: HashId, reportOp: ReportOp): Step {
  return {
    ext: {},
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
  TContext extends Context<any> = Context<any>,
  TStep extends Step<any> = Step<any>,
> implements ExecutionDriver<TContext, TStep>
{
  constructor(public state: StateDriver) {
    this.state = state;
  }

  async execute<TInput extends InputDefault, TOutput>(
    workflow: Workflow<TInput, TOutput, TContext, TStep>,
    ctx: TContext
  ): Promise<OpResult[]> {
    if (workflow.inputSchema !== undefined) {
      const result = await workflow.inputSchema["~standard"].validate(
        ctx.input
      );

      if (result.issues !== undefined && result.issues.length > 0) {
        return [
          await this.onWorkflowResult(workflow, ctx, {
            config: { code: StdOpCode.workflow },
            id: { hashed: "", id: "", index: 0 },
            result: {
              status: "error",
              error: toJsonError(new InvalidInputError(result.issues)),
            },
          }),
        ];
      }
    }

    return findOps({
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

  async invoke<TInput extends InputDefault, TOutput>(
    _workflow: Workflow<TInput, TOutput, TContext, TStep>,
    _input: StripStandardSchema<TInput>
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
    this.state.setOp({ runId: ctx.runId, hashedOpId: op.id.hashed }, op);
    return op;
  };
}

/**
 * Handle ops that have already been found. Return the new ops.
 */
export function handleExistingOps(
  state: StateDriver,
  ctx: Context,
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
  TContext extends Context,
  TStep extends Step,
  TOutput,
>(
  state: StateDriver,
  workflow: Workflow<any, any, TContext, TStep>,
  ctx: Context,
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
