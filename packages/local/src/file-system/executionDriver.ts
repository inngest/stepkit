import {
  BaseExecutionDriver,
  createStdStep,
  type ReportOp,
  type Step,
} from "@stepkit/sdk-tools";

export class FileSystemDriver extends BaseExecutionDriver {
  async getStep(reportOp: ReportOp): Promise<Step> {
    return createStdStep(reportOp);
  }
}
