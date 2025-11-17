import { z } from "zod";

import { StdOpCode, type OpResult } from "./types";

const invokeWorkflowOpConfigSchema = z.object({
  code: z.literal(StdOpCode.invokeWorkflow),
  options: z.object({
    clientId: z.string(),
    data: z.unknown(),
    timeout: z.number(),
    workflowId: z.string(),
  }),
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
