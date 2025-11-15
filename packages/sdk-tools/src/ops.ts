import { z } from "zod";

import { StdOpCode, type OpResult } from "./types";

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
  sleep: isSleepOpResult,
  waitForSignal: isWaitForSignalOpResult,
};

export type OpResults = {
  sleep: SleepOpResult;
  waitForSignal: WaitForSignalOpResult;
};

export type OpConfigs = {
  sleep: SleepOpConfig;
  waitForSignal: WaitForSignalOpConfig;
};
