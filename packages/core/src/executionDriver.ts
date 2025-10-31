import type { Workflow } from "./workflow";
import type {
  OpResult,
  OpFound,
  ControlFlow,
  StdContext,
  BaseContext,
} from "./types";
import { StdOpcode, controlFlow } from "./types";
import { process, ReportOp } from "./process";
import { createControlledPromise } from "./promises";
import { parseOpConfig } from "./ops";
import { stdOpResult } from "./types";
import type { RunStateDriver } from "./runStateDriver";

export type ExecutionDriver<TContext extends StdContext> = {
  execute: (
    workflow: Workflow<TContext, any>,
    runId: string
  ) => Promise<OpResult[]>;
  getContext: (reportOp: ReportOp, runId: string) => Promise<TContext>;
  invoke: <TOutput>(workflow: Workflow<TContext, TOutput>) => Promise<TOutput>;
};

export function createStdStepContext(reportOp: ReportOp): StdContext["step"] {
  return {
    run: async <TStepRunOutput>(
      stepId: string,
      handler: () => Promise<TStepRunOutput>
    ): Promise<TStepRunOutput> => {
      // Pause until all steps are reported
      const output = await reportOp<TStepRunOutput>({
        config: {
          code: StdOpcode.stepRun,
          options: { handler },
        },
        id: {
          hashed: stepId,
          id: stepId,
          index: 0,
        },
        promise: createControlledPromise<TStepRunOutput>(),
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
        promise: createControlledPromise(),
      });
    },
  };
}

// export function createStdStepContext(reportOp: ReportOp): StdContext["step"] {
//   return {
//     run: async <TStepRunOutput>(
//       stepId: string,
//       handler: () => Promise<TStepRunOutput>
//     ): Promise<TStepRunOutput> => {
//       // Pause until all steps are reported
//       const output = await reportOp<TStepRunOutput>({
//         config: {
//           code: StdOpcode.stepRun,
//           options: { handler },
//         },
//         id: {
//           hashed: stepId,
//           id: stepId,
//           index: 0,
//         },
//         promise: createControlledPromise<TStepRunOutput>(),
//       });
//       return output;
//     },
//     sleep: async (stepId: string, duration: number) => {
//       return await reportOp({
//         config: {
//           code: StdOpcode.stepSleep,
//           options: { wakeupAt: new Date(Date.now() + duration) },
//         },
//         id: { hashed: stepId, id: stepId, index: 0 },
//         promise: createControlledPromise(),
//       });
//     },
//   };
// }

/**
 * Concrete execution driver implementation. Can be extended.
 */
export class BaseExecutionDriver<TContext extends StdContext = StdContext>
  implements ExecutionDriver<TContext>
{
  constructor(public state: RunStateDriver) {
    this.state = state;
  }

  async execute(workflow: Workflow<TContext, any>, runId: string) {
    return process<TContext, any>({
      workflow,
      onOpsFound: this.onOpsFound,
      getContext: this.getContext,
      runId,
    });
  }

  getContext = async (reportOp: ReportOp, runId: string): Promise<TContext> => {
    const baseContext = await this.state.getBaseContext(runId);

    // @ts-expect-error - TODO: fix this. Since child classes can add more
    // steps, the returned steps may not be all the defined steps
    return {
      ...baseContext,
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
  };

  async invoke<TOutput>(
    workflow: Workflow<TContext, TOutput>
  ): Promise<TOutput> {
    throw new Error("not implemented");
  }

  onOpsFound = async (
    workflow: Workflow<TContext, any>,
    runId: string,
    ops: OpFound[]
  ): Promise<ControlFlow> => {
    const newOps = handleOps(this.state, runId, ops);

    return handleNewOps(this.state, runId, newOps);
  };
}

/**
 * Handle ops that have already been found. Return the new ops.
 */
function handleOps(
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

/**
 * Handle a new op. Return the control flow.
 */
async function handleNewOps(
  state: RunStateDriver,
  runId: string,
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
        state.setOp({ runId, hashedOpId: newOp.id.hashed }, result);
        newOp.promise.resolve(output);
      } catch (e) {
        let error: Error;
        if (e instanceof Error) {
          error = e;
        } else {
          error = new Error(String(e));
        }
        result = stdOpResult.stepRunError(newOp, error);
        state.setOp({ runId, hashedOpId: newOp.id.hashed }, result);
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
