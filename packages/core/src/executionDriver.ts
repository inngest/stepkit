import type { Workflow } from "./workflow";
import type {
  OpResult,
  OpFound,
  ControlFlow,
  StdContext,
  StdStep,
  OpConfig,
} from "./types";
import { StdOpCode, controlFlow } from "./types";
import { findOps, ReportOp } from "./findOps";
import { createControlledPromise } from "./promises";
import type { RunStateDriver } from "./runStateDriver";

export type ExecutionDriver<
  TContext extends StdContext,
  TStep extends StdStep,
> = {
  state: RunStateDriver<TContext>;

  execute: (
    workflow: Workflow<TContext, TStep, any>,
    runId: string
  ) => Promise<OpResult[]>;
  getSteps: (reportOp: ReportOp) => Promise<TStep>;
  invoke: <TOutput>(
    workflow: Workflow<TContext, TStep, TOutput>
  ) => Promise<TOutput>;
};

export function createStdStep(reportOp: ReportOp): StdStep {
  return {
    run: async <TStepRunOutput>(
      stepId: string,
      handler: () => Promise<TStepRunOutput>
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
  constructor(public state: RunStateDriver<TContext>) {
    this.state = state;
  }

  async execute<TOutput>(
    workflow: Workflow<TContext, TStep, TOutput>,
    runId: string
  ) {
    const ctx = await this.state.getContext(runId);

    return findOps<TContext, TStep, TOutput>({
      workflow,
      ctx,
      onOpsFound: (ops) => this.onOpsFound(workflow, runId, ops),
      getSteps: this.getSteps,
    });
  }

  async getSteps(reportOp: ReportOp): Promise<TStep> {
    // @ts-expect-error - This has a type error because child classes can add
    // more steps. So if more steps exist in TStep then the child class must
    // extend this method's return type
    return createStdStep(reportOp);
  }

  async invoke<TOutput>(
    workflow: Workflow<TContext, TStep, TOutput>
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
    if (item) {
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

export function createOpFound<TOutput>(
  reportOp: ReportOp,
  id: string,
  config: OpConfig,
  handler?: (() => Promise<TOutput>) | undefined
): Promise<TOutput> {
  return reportOp<TOutput>({
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
    let opResult: OpResult = {
      config: op.config,
      id: op.id,
      result: { status: "success", output: undefined },
    };

    if (op.handler) {
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
