import { z } from "zod";

import { StdOpCode, type OpResult } from "./types";

export const OpMode = {
  /**
   * Op is executed immediately SDK-side. For example, a `step.run` executes
   * when encountered (unless in parallel)
   */
  immediate: "immediate",

  /**
   * Op is executed later via scheduling with the backend. For example, a
   * `step.sleep` schedules a future wake job
   */
  scheduled: "scheduled",
} as const satisfies Record<"immediate" | "scheduled", string>;
export type OpMode = (typeof OpMode)[keyof typeof OpMode];
const opModeSchema = z.enum([OpMode.immediate, OpMode.scheduled]);

const invokeWorkflowOpConfigSchema = z.object({
  code: z.literal(StdOpCode.invokeWorkflow),
  options: z.object({
    clientId: z.string(),
    data: z.unknown(),
    timeout: z.number(),
    workflowId: z.string(),
  }),
  mode: opModeSchema,
});
type InvokeWorkflowOpConfig = z.infer<typeof invokeWorkflowOpConfigSchema>;
type InvokeWorkflowOpResult = OpResult<InvokeWorkflowOpConfig>;
function isInvokeWorkflowOpResult(op: OpResult): op is InvokeWorkflowOpResult {
  return invokeWorkflowOpConfigSchema.safeParse(op.config).success;
}

const sleepOpConfigSchema = z.object({
  code: z.literal(StdOpCode.sleep),
  options: z.object({
    wakeAt: z.number(),
  }),
  mode: opModeSchema,
});
type SleepOpConfig = z.infer<typeof sleepOpConfigSchema>;
type SleepOpResult = OpResult<SleepOpConfig>;
function isSleepOpResult(op: OpResult): op is OpResult<SleepOpConfig> {
  return sleepOpConfigSchema.safeParse(op.config).success;
}

const waitForSignalOpConfigSchema = z.object({
  code: z.literal(StdOpCode.waitForSignal),
  options: z.object({
    signal: z.string(),
    timeout: z.number(),
  }),
  mode: opModeSchema,
});
type WaitForSignalOpConfig = z.infer<typeof waitForSignalOpConfigSchema>;
type WaitForSignalOpResultData = {
  data: unknown;
  signal: string;
} | null;
type WaitForSignalOpResult = OpResult<
  WaitForSignalOpConfig,
  WaitForSignalOpResultData
>;
function isWaitForSignalOpResult(op: OpResult): op is WaitForSignalOpResult {
  return waitForSignalOpConfigSchema.safeParse(op.config).success;
}

export const isOpResult = {
  invokeWorkflow: isInvokeWorkflowOpResult,
  sleep: isSleepOpResult,
  waitForSignal: isWaitForSignalOpResult,
};

export type OpResults = {
  invokeWorkflow: InvokeWorkflowOpResult;
  sleep: SleepOpResult;
  waitForSignal: WaitForSignalOpResult;
};

export type OpConfigs = {
  invokeWorkflow: InvokeWorkflowOpConfig;
  sleep: SleepOpConfig;
  waitForSignal: WaitForSignalOpConfig;
};
