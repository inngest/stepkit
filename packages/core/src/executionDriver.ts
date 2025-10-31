import type { Workflow } from "./workflow";
import type { OpResult, OpFound, ControlFlow, StdContext } from "./types";
import { StdOpcode, controlFlow } from "./types";
import { process } from "./process";
import { createControlledPromise } from "./promises";
import { parseOpConfig } from "./ops";
import { stdOpResult } from "./types";
import type { RunStateDriver } from "./runStateDriver";

export type ExecutionDriver<TContext> = {
  execute: (workflow: Workflow<TContext, any>) => Promise<OpResult[]>;
  getContext: (
    reportOp: <TOutput>(op: OpFound<any, TOutput>) => Promise<TOutput>
  ) => TContext;
  invoke: <TOutput>(workflow: Workflow<TContext, TOutput>) => Promise<TOutput>;
};

/**
 * Concrete execution driver implementation. Can be extended.
 */
export class BaseExecutionDriver implements ExecutionDriver<StdContext> {
  constructor(public state: RunStateDriver) {
    this.state = state;
  }

  async execute(workflow: Workflow<StdContext, any>) {
    return process<StdContext, any>({
      workflow,
      onOpsFound: this.onOpsFound,
      getContext: this.getContext,
    });
  }

  getContext(
    reportOp: <TOutput>(op: OpFound<any, TOutput>) => Promise<TOutput>
  ): StdContext {
    return {
      step: {
        run: async <T>(
          stepId: string,
          handler: () => Promise<T>
        ): Promise<T> => {
          // Pause until all steps are reported
          const output = await reportOp<T>({
            config: {
              code: StdOpcode.stepRun,
              options: { handler },
            },
            id: {
              hashed: stepId,
              id: stepId,
              index: 0,
            },
            promise: createControlledPromise<T>(),
          });
          return output;
        },
        sleep: async (stepId: string, duration: number) => {
          return await reportOp({
            config: {
              code: StdOpcode.stepSleep,
              options: { wakeupAt: new Date(Date.now() + duration) },
            },
            id: { hashed: stepId, id: stepId, index: 0 },
            promise: createControlledPromise<any>(),
          });
        },
      },
    };
  }

  async invoke<TOutput>(
    workflow: Workflow<StdContext, TOutput>
  ): Promise<TOutput> {
    throw new Error("not implemented");
  }

  onOpsFound = async (
    _workflow: Workflow<StdContext, any>,
    _ops: OpFound[]
  ): Promise<ControlFlow> => {
    const newOps = handleOps(this.state, _ops);

    return handleNewOps(this.state, newOps);
  };
}

/**
 * Handle ops that have already been found. Return the new ops.
 */
function handleOps(state: RunStateDriver, ops: OpFound[]): OpFound[] {
  const newOps: OpFound[] = [];
  for (const op of ops) {
    const item = state.getOp({ runId: "TODO", hashedOpId: op.id.hashed });
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

/**
 * Handle a new op. Return the control flow.
 */
async function handleNewOps(
  state: RunStateDriver,
  newOps: OpFound[]
): Promise<ControlFlow> {
  if (newOps.length === 1) {
    const newOp = newOps[0];
    const newOpConfig = parseOpConfig(newOp.config);

    if (newOpConfig.code === StdOpcode.stepRun) {
      let result: OpResult;
      try {
        const output = await newOpConfig.options.handler();
        result = stdOpResult.stepRunSuccess(newOp, output);
        state.setOp({ runId: "TODO", hashedOpId: newOp.id.hashed }, result);
        newOp.promise.resolve(output);
      } catch (e) {
        let error: Error;
        if (e instanceof Error) {
          error = e;
        } else {
          error = new Error(String(e));
        }
        result = stdOpResult.stepRunError(newOp, error);
        state.setOp({ runId: "TODO", hashedOpId: newOp.id.hashed }, result);
      }
      return controlFlow.interrupt([result]);
    }

    if (newOpConfig.code === StdOpcode.stepSleep) {
      return controlFlow.interrupt([stdOpResult.stepSleep(newOp)]);
    }

    throw new Error(`unexpected op code: ${newOp.config.code}`);
  } else if (newOps.length > 1) {
    throw new Error("not implemented");
  }

  return controlFlow.continue();
}
