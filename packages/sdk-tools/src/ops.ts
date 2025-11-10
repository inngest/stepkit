import { z } from "zod";

import { StdOpCode, type OpResult } from "./types";

const sleepOpConfigSchema = z.object({
  code: z.literal(StdOpCode.sleep),
  options: z.object({
    wakeAt: z.number(),
  }),
});
export type SleepOpConfig = z.infer<typeof sleepOpConfigSchema>;
export function isSleepOpResult(op: OpResult): op is OpResult<SleepOpConfig> {
  return sleepOpConfigSchema.safeParse(op.config).success;
}
