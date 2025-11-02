import { findOps, type ReportOp } from "./findOps";
import { createControlledPromise } from "./promises";
import type { RunStateDriver } from "./runStateDriver";
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
import { ensureAsync } from "./utils";
import type { Workflow } from "./workflow";

export type ExecutionDriver<
  TContext extends StdContext,
  TStep extends StdStep,
> = {
  state: RunStateDriver;

  getSteps: (reportOp: ReportOp) => Promise<TStep>;
  invoke: <TOutput>(
    workflow: Workflow<TContext, TStep, TOutput>
  ) => Promise<TOutput>;
};

export function createStdStep(reportOp: ReportOp): StdStep {
  return {
    run: async <TStepRunOutput>(
      stepId: string,
      handler: (() => Promise<TStepRunOutput>) | (() => TStepRunOutput)
    ): Promise<TStepRunOutput> => {
      return createOpFound(reportOp, stepId, { code: StdOpCode.run }, handler);
    },
    sleep: async (stepId: string, duration: number) => {
      return createOpFound(reportOp, stepId, {
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
  TContext extends StdContext = StdContext,
  TStep extends StdStep = StdStep,
> implements ExecutionDriver<TContext, TStep>
{
  constructor(public state: RunStateDriver) {
    this.state = state;
  }

  async execute<TOutput>(
    workflow: Workflow<TContext, TStep, TOutput>,
    ctx: TContext
  ): Promise<OpResult[]> {
    return findOps<TContext, TStep, TOutput>({
      workflow,
      ctx,
      onOpsFound: (ops) => this.onOpsFound(workflow, ctx.runId, ops),
      getSteps: (reportOp) => this.getSteps(reportOp),
    });
  }

  getSteps(reportOp: ReportOp): Promise<TStep> {
    // @ts-expect-error - This has a type error because child classes can add
    // more steps. So if more steps exist in TStep then the child class must
    // extend this method's return type
    return createStdStep(reportOp);
  }

  async invoke<TOutput>(
    _workflow: Workflow<TContext, TStep, TOutput>
  ): Promise<TOutput> {
    throw new Error("not implemented");
  }

  onOpsFound = async (
    workflow: Workflow<TContext, TStep, any>,
    runId: string,
    ops: OpFound[]
  ): Promise<ControlFlow> => {
    const newOps = handleExistingOps(this.state, runId, ops);

    return await createOpResults(this.state, newOps, runId);
  };
}

/**
 * Handle ops that have already been found. Return the new ops.
 */
export function handleExistingOps(
  state: RunStateDriver,
  runId: string,
  ops: OpFound[]
): OpFound[] {
  const newOps: OpFound[] = [];
  for (const op of ops) {
    const item = state.getOp({ runId, hashedOpId: op.id.hashed });
    if (item !== undefined) {
      if (item.result.status === "success") {
        // Op already succeeded, so return its output
        op.promise.resolve(item.result.output);
      } else {
        // Op already failed, so throw its error
        op.promise.reject(item.result.error);
      }
    } else {
      // Op found for the first time
      newOps.push(op);
    }
  }
  return newOps;
}

export async function createOpFound<TOutput>(
  reportOp: ReportOp,
  id: string,
  config: OpConfig,
  handler?: (() => Promise<TOutput>) | (() => TOutput)
): Promise<TOutput> {
  if (handler !== undefined) {
    handler = ensureAsync(handler);
  }

  return await reportOp<TOutput>({
    config,
    handler,
    id: { hashed: id, id, index: 0 },
    promise: createControlledPromise<TOutput>(),
  });
}

export async function createOpResults<TOutput>(
  state: RunStateDriver,
  ops: OpFound<OpConfig, TOutput>[],
  runId: string
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
        let error: Error;
        if (e instanceof Error) {
          error = e;
        } else {
          error = new Error(String(e));
        }
        opResult.result = { status: "error", error };
      }
    }

    state.setOp({ runId, hashedOpId: op.id.hashed }, opResult);
    opResults.push(opResult);
  }

  if (opResults.length === 0) {
    return controlFlow.continue();
  }

  return controlFlow.interrupt(opResults);
}
