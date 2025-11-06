import {
  BaseExecutionDriver,
  createOpFound,
  createStdStep,
  stdHashId,
  StdOpCode,
  type ExtDefault,
  type ReportOp,
  type Step,
} from "@stepkit/sdk-tools";

import { CommRequestStateDriver } from "./stateDriver";
import type { CommRequest } from "./types";

export type CustomStep = Step<{
  sleepUntil: (stepId: string, wakeupAt: Date) => Promise<void>;
}>;

export type StepExt = {
  sleepUntil: (stepId: string, wakeupAt: Date) => Promise<void>;
};

export class ExecutionDriver extends BaseExecutionDriver<
  ExtDefault,
  ExtDefault,
  StepExt
> {
  constructor(commRequest: CommRequest) {
    super(new CommRequestStateDriver(commRequest));
  }

  async getStep(reportOp: ReportOp): Promise<Step<StepExt>> {
    return {
      ...createStdStep(stdHashId, reportOp),
      ext: {
        sleepUntil: async (stepId: string, wakeupAt: Date) => {
          await createOpFound(stdHashId, reportOp, stepId, {
            code: StdOpCode.sleep,
            options: { wakeupAt },
          });
        },
      },
    };
  }
}
