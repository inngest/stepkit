import type { Workflow } from "@stepkit/core";
import {
  BaseExecutionDriver,
  type InputSchemaDefault,
  type OpResult,
  type ReportOp,
  type StartData,
  type StateDriver,
  type Step,
  type StripStandardSchema,
} from "@stepkit/core/implementer";

class NoopStateDriver implements StateDriver {
  getOp(_id: { runId: string; hashedOpId: string }): OpResult | undefined {
    throw new Error("not implemented");
  }
  setOp(_id: { runId: string; hashedOpId: string }, _op: OpResult): void {
    throw new Error("not implemented");
  }
}

export class InngestDriver extends BaseExecutionDriver {
  constructor() {
    super(new NoopStateDriver());
  }

  getStep(_reportOp: ReportOp): Promise<Step> {
    throw new Error("not implemented");
  }

  startWorkflow<TInput extends InputSchemaDefault>(
    _workflow: Workflow<TInput, any>,
    _input: StripStandardSchema<TInput>
  ): Promise<StartData> {
    throw new Error("not implemented");
  }
}
