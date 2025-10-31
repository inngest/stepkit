import type { Workflow } from "./workflow";
import type { OpResult, OpFound, ControlFlow, StdContext } from "./types";
import { StdOpcode, controlFlow } from "./types";
import { runOpController } from "./opController";
import { createControlledPromise } from "./promises";
import { parseOpConfig } from "./ops";
import { stdOpResult } from "./types";
import type { RunStateDriver } from "./runStateDriver";

export type ExecutionDriver<TContext> = {
  execute: (
    state: RunStateDriver,
    workflow: Workflow<TContext, any>
  ) => Promise<OpResult[]>;
  getContext: (reportOp: (operation: OpFound) => Promise<void>) => TContext;
};

/**
 * Concrete execution driver implementation. Can be extended.
 */
export class BaseExecutionDriver implements ExecutionDriver<StdContext> {
  async execute(state: RunStateDriver, workflow: Workflow<StdContext, any>) {
    return runOpController<StdContext, any>({
      workflow,
      state,
      onOpsFound: this.onOpsFound,
      getContext: this.getContext,
    });
  }

  getContext(reportOp: (operation: OpFound) => Promise<void>): StdContext {
    return {
      step: {
        run: async <T>(stepId: string, handler: () => Promise<T>) => {
          const controlledPromise = createControlledPromise<any>();

          // Pause until all steps are reported
          await reportOp({
            config: {
              code: StdOpcode.stepRunFound,
              options: { handler },
            },
            id: {
              hashed: stepId,
              id: stepId,
              index: 0,
            },
            promise: controlledPromise,
          });

          return controlledPromise.promise;
        },
        sleep: async (stepId: string, duration: number) => {
          await reportOp({
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

  async onOpsFound(
    workflow: Workflow<StdContext, any>,
    state: RunStateDriver,
    ops: OpFound[]
  ): Promise<ControlFlow> {
    const newOps = handleOps(state, ops);

    if (newOps.length === 1) {
      return handleNewOps(state, newOps);
    } else if (newOps.length > 1) {
      // TODO: Implement
      return controlFlow.interrupt([]);
    }

    return controlFlow.continue();
  }
}

/**
 * Handle ops that have already been found. Return the new ops.
 */
function handleOps(state: RunStateDriver, ops: OpFound[]): OpFound[] {
  const newOps: OpFound[] = [];
  for (const op of ops) {
    const item = state.getOp(op.id.hashed);
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

    if (newOpConfig.code === StdOpcode.stepRunFound) {
      let result: OpResult;
      try {
        const output = await newOpConfig.options.handler();
        result = stdOpResult.stepRunSuccess(newOp, output);
        state.setOp(newOp.id.hashed, result);
        newOp.promise.resolve(output);
      } catch (e) {
        let error: Error;
        if (e instanceof Error) {
          error = e;
        } else {
          error = new Error(String(e));
        }
        result = stdOpResult.stepRunError(newOp, error);
        state.setOp(newOp.id.hashed, result);
      }
      return controlFlow.interrupt([result]);
    }

    if (newOpConfig.code === StdOpcode.stepSleep) {
      return controlFlow.interrupt([stdOpResult.stepSleep(newOp)]);
    }

    throw new Error(`unexpected op code: ${newOp.config.code}`);
  } else if (newOps.length > 1) {
    // TODO: Implement
    return controlFlow.interrupt([]);
  }

  return controlFlow.continue();
}
