import { OpMode, type OpResult, type StateDriver } from "@stepkit/sdk-tools";

import type { CommRequest } from "./types";

export class CommRequestStateDriver implements StateDriver {
  private commRequest: CommRequest;
  ops: OpResult[];

  constructor(commRequest: CommRequest) {
    this.commRequest = commRequest;
    this.ops = [];
  }

  async getOp({
    hashedOpId,
  }: {
    runId: string;
    hashedOpId: string;
  }): Promise<OpResult | undefined> {
    const stepResult = this.commRequest.steps[hashedOpId];
    if (stepResult === undefined) {
      return undefined;
    }

    let result: OpResult["result"];
    if (stepResult === null) {
      result = {
        status: "success",
        output: null,
      };
    } else if ("data" in stepResult) {
      result = {
        status: "success",
        output: stepResult.data,
      };
    } else {
      throw new Error("not implemented");
    }

    return {
      config: {
        code: "unknown",
        mode: OpMode.immediate,
      },
      opId: { hashed: hashedOpId, id: "unknown", index: 0 },
      runId: "unknown",
      workflowId: "unknown",
      result,
    };
  }

  async setOp(
    { hashedOpId }: { runId: string; hashedOpId: string },
    _op: OpResult
  ): Promise<void> {
    if (hashedOpId in this.commRequest.steps) {
      return;
    }

    this.ops.push(_op);
  }
}
