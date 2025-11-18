import { AsyncLocalStorage } from "async_hooks";

import {
  InvalidInputError,
  NestedStepError,
  type Workflow,
} from "@stepkit/core";
import {
  type Context,
  type ExtDefault,
  type InputDefault,
  type SendSignalOpts,
  type StartData,
  type Step,
  type WaitForSignalOpts,
} from "@stepkit/core/implementer";

import { fromJsonError, toJsonError } from "./errors";
import { findOps, type ReportOp } from "./findOps";
import { OpMode, type OpConfigs } from "./ops";
import { createControlledPromise } from "./promises";
import type { StateDriver } from "./stateDriver";
import {
  controlFlow,
  StdOpCode,
  type ControlFlow,
  type OpConfig,
  type OpFound,
  type OpResult,
} from "./types";
import { ensureAsync, stdHashId, type HashId } from "./utils";

// Used to detect nested steps
export const insideStep = {
  clear: (): void => {
    insideStep.storage.disable();
  },
  get: (): string | undefined => {
    const value = insideStep.storage.getStore();
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== "string") {
      throw new Error("unreachable: invalid value in AsyncLocalStorage");
    }
    return value;
  },
  set: (stepId: string): void => {
    insideStep.storage.enterWith(stepId);
  },
  storage: new AsyncLocalStorage(),
};

export type ExecutionDriver<
  TWorkflowCfgExt extends ExtDefault,
  TCtxExt extends ExtDefault,
  TStepExt extends ExtDefault,
> = {
  addWorkflow: (
    workflow: Workflow<any, any, TWorkflowCfgExt, TCtxExt, TStepExt>
  ) => void;

  startWorkflow: <TInput extends InputDefault, TOutput>(
    workflow: Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt>,
    input: TInput
  ) => Promise<StartData>;
};

export function createStdStep(reportOp: ReportOp): Step {
  return {
    ext: {},
    invokeWorkflow: async <TInput extends InputDefault, TOutput>(
      stepId: string,
      opts: {
        data?: TInput;
        timeout: number | Date;
        workflow: Workflow<TInput, TOutput>;
      }
    ) => {
      let timeout: number;
      if (opts.timeout instanceof Date) {
        timeout = opts.timeout.getTime() - Date.now();
      } else {
        timeout = opts.timeout;
      }

      const config: OpConfigs["invokeWorkflow"] = {
        code: StdOpCode.invokeWorkflow,
        mode: OpMode.scheduled,
        options: {
          clientId: opts.workflow.client.id,
          data: opts.data,
          timeout,
          workflowId: opts.workflow.id,
        },
      };
      return createOpFound(reportOp, stepId, config);
    },
    run: async <TStepRunOutput>(
      stepId: string,
      handler: (() => Promise<TStepRunOutput>) | (() => TStepRunOutput)
    ): Promise<TStepRunOutput> => {
      return createOpFound(
        reportOp,
        stepId,
        {
          code: StdOpCode.run,
          mode: OpMode.immediate,
        },
        handler
      );
    },
    sendSignal: async (stepId: string, opts: SendSignalOpts) => {
      return createOpFound(reportOp, stepId, {
        code: StdOpCode.sendSignal,
        options: opts,
        mode: OpMode.scheduled,
      });
    },
    sleep: async (stepId: string, duration: number) => {
      const config: OpConfigs["sleep"] = {
        code: StdOpCode.sleep,
        mode: OpMode.scheduled,
        options: { wakeAt: Date.now() + duration },
      };
      return createOpFound(reportOp, stepId, config);
    },
    sleepUntil: async (stepId: string, wakeAt: Date) => {
      return createOpFound(reportOp, stepId, {
        code: StdOpCode.sleep,
        mode: OpMode.scheduled,
        options: { wakeAt },
      });
    },
    waitForSignal: async <T>(
      stepId: string,
      opts: WaitForSignalOpts<T>
    ): Promise<{ data: T; signal: string } | null> => {
      return createOpFound(reportOp, stepId, {
        code: StdOpCode.waitForSignal,
        mode: OpMode.scheduled,
        options: opts,
      });
    },
  };
}

/**
 * Concrete execution driver implementation. Can be extended.
 */
export abstract class BaseExecutionDriver<
  TWorkflowCfgExt extends ExtDefault = ExtDefault,
  TCtxExt extends ExtDefault = ExtDefault,
  TStepExt extends ExtDefault = ExtDefault,
> {
  constructor(
    public state: StateDriver,
    public hashId: HashId = stdHashId
  ) {
    this.state = state;
  }

  async execute<TInput extends InputDefault, TOutput>(
    workflow: Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt>,
    ctx: Context<TInput, TCtxExt>
  ): Promise<OpResult[]> {
    if (workflow.inputSchema !== undefined) {
      const result = await workflow.inputSchema["~standard"].validate(
        ctx.input.data
      );

      if (result.issues !== undefined && result.issues.length > 0) {
        return [
          await this.onWorkflowResult(workflow, ctx, {
            config: {
              code: StdOpCode.workflow,
              mode: OpMode.immediate,
            },
            opId: { hashed: "", id: "", index: 0 },
            result: {
              status: "error",
              error: toJsonError(new InvalidInputError(result.issues)),
            },
            runId: ctx.runId,
            workflowId: workflow.id,
          }),
        ];
      }
    }

    return findOps({
      ctx,
      getStep: (reportOp) => this.getStep(reportOp),
      hashId: this.hashId,
      onStepsFound: (ops) => this.onStepsFound(workflow, ctx, ops),
      onWorkflowResult: (op) => this.onWorkflowResult(workflow, ctx, op),
      workflow,
    });
  }

  abstract getStep(reportOp: ReportOp): Promise<Step<TStepExt>>;

  onStepsFound = async <TInput extends InputDefault>(
    workflow: Workflow<TInput, unknown, TWorkflowCfgExt, TCtxExt, TStepExt>,
    ctx: Context<TInput, TCtxExt>,
    ops: OpFound[]
  ): Promise<ControlFlow> => {
    const newOps = await handleExistingOps(this.state, ctx, ops);

    return await createOpResults(this.state, workflow, ctx, newOps);
  };

  onWorkflowResult = async <TInput extends InputDefault>(
    workflow: Workflow<TInput, unknown, TWorkflowCfgExt, TCtxExt, TStepExt>,
    ctx: Context<TInput, TCtxExt>,
    op: OpResult
  ): Promise<OpResult> => {
    await this.state.setOp(
      { runId: ctx.runId, hashedOpId: op.opId.hashed },
      op
    );
    return op;
  };
}

/**
 * Handle ops that have already been found. Return the new ops.
 */
export async function handleExistingOps(
  state: StateDriver,
  ctx: Context,
  ops: OpFound[]
): Promise<OpFound[]> {
  const newOps: OpFound[] = [];
  for (const op of ops) {
    const item = await state.getOp({
      runId: ctx.runId,
      hashedOpId: op.id.hashed,
    });
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
  reportOp: ReportOp,
  id: string,
  config: OpConfig,
  handler?: (() => Promise<TOutput>) | (() => TOutput)
): Promise<TOutput> {
  const parentStepId = insideStep.get();
  if (parentStepId !== undefined) {
    throw new NestedStepError({
      stepId: id,
      parentStepId,
    });
  }
  if (handler !== undefined) {
    handler = ensureAsync(handler);
  }

  // TODO: Increment index when op is found multiple times
  const index = 0;

  return await reportOp<TOutput>({
    config,
    handler,
    id: {
      // Will be set within findOps
      hashed: "PLACEHOLDER",

      id,
      index,
    },
    promise: createControlledPromise<TOutput>(),
  });
}

export async function createOpResults<
  TInput extends InputDefault,
  TOutput,
  TWorkflowCfgExt extends ExtDefault,
  TCtxExt extends ExtDefault,
  TStepExt extends ExtDefault,
>(
  state: StateDriver,
  workflow: Workflow<TInput, TOutput, TWorkflowCfgExt, TCtxExt, TStepExt>,
  ctx: Context<TInput, TCtxExt>,
  ops: OpFound<OpConfig, TOutput>[]
): Promise<ControlFlow> {
  const opResults: OpResult[] = [];
  for (const op of ops) {
    const opResult: OpResult = {
      config: op.config,
      opId: op.id,
      result: { status: "success", output: undefined },
      runId: ctx.runId,
      workflowId: workflow.id,
    };

    if (op.handler !== undefined) {
      // Dynamic op
      try {
        insideStep.set(op.id.id);
        const output = await op.handler();
        opResult.result = { status: "success", output };
      } catch (e) {
        opResult.result = {
          status: "error",
          error: toJsonError(e),
        };
      } finally {
        insideStep.clear();
      }
    }

    await state.setOp({ runId: ctx.runId, hashedOpId: op.id.hashed }, opResult);
    opResults.push(opResult);
  }

  if (opResults.length === 0) {
    return controlFlow.continue();
  }

  return controlFlow.interrupt(opResults);
}
