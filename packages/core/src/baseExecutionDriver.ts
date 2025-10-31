import type { Workflow } from "./workflow";
import type { OpResult, OpFound, ControlFlow, RunState } from "./types";
import { toResult, Opcode, controlFlow } from "./types";
import { execute } from "./execute";
import { createControlledPromise } from "./promises";

type Context = {
  step: {
    run: <T>(stepId: string, handler: () => Promise<T>) => Promise<T>;
    sleep: (stepId: string, duration: number) => Promise<void>;
  };
};

export function isStepRunFound(step: OpFound): step is OpFound<{
  code: typeof Opcode.stepRunFound;
  options: { handler: () => Promise<unknown> };
}> {
  return step.config.code === Opcode.stepRunFound;
}

export function isStepSleepFound(op: OpFound): op is OpFound<{
  code: typeof Opcode.stepSleep;
  options: { wakeupAt: Date };
}> {
  return op.config.code === Opcode.stepSleep;
}

export class BaseExecutionDriver {
  async execute(state: RunState, workflow: Workflow<Context, any>) {
    return execute<Context, any>({
      workflow,
      state,
      onOpsFound: this.onOpsFound,
      getContext: this.getContext,
    });
  }

  getContext(reportOp: (operation: OpFound) => Promise<void>): Context {
    return {
      step: {
        run: async <T>(stepId: string, handler: () => Promise<T>) => {
          const controlledPromise = createControlledPromise<any>();

          // Pause until all steps are reported
          await reportOp({
            config: {
              code: Opcode.stepRunFound,
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
              code: Opcode.stepSleep,
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
    workflow: Workflow<Context, any>,
    state: RunState,
    ops: OpFound[]
  ): Promise<ControlFlow> {
    const newOps: OpFound[] = [];
    for (const op of ops) {
      // NOTE - Run state can't be attached to the driver - could be used in multiple workflows
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

    if (newOps.length === 1) {
      const newOp = newOps[0];
      if (isStepRunFound(newOp)) {
        let result: OpResult;
        try {
          const output = await newOp.config.options.handler();
          result = toResult.stepRunSuccess(newOp, output);
          state.setOp(newOp.id.hashed, result);
          newOp.promise.resolve(output);
        } catch (e) {
          let error: Error;
          if (e instanceof Error) {
            error = e;
          } else {
            error = new Error(String(e));
          }
          result = toResult.stepRunError(newOp, error);
          state.setOp(newOp.id.hashed, result);
        }
        return controlFlow.interrupt([result]);
      }
      if (isStepSleepFound(newOp)) {
        return controlFlow.interrupt([toResult.stepSleep(newOp)]);
      }
    } else if (newOps.length > 1) {
      // TODO: Implement
      return controlFlow.interrupt([]);
    }

    return controlFlow.continue();
  }
}
