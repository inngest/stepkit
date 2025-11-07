import type { Workflow } from "@stepkit/core";
import { StdOpCode, type Context, type ExtDefault } from "@stepkit/sdk-tools";

import { ExecutionDriver, type StepExt } from "./executionDriver";
import type { CommRequest, CommResponse } from "./types";

export async function execute(
  workflow: Workflow<any, any, ExtDefault, ExtDefault, StepExt>,
  req: CommRequest
): Promise<CommResponse> {
  const driver = new ExecutionDriver(req);

  const ctx: Context = {
    ext: {},
    input: {
      data: {},
      ext: {},
      id: crypto.randomUUID(),
      name: "fake",
      time: new Date(),
      type: "event",
    },
    runId: req.ctx.run_id,
  };
  const ops = await driver.execute(workflow, ctx);
  if (ops.length === 1 && ops[0] !== undefined) {
    const op = ops[0];
    if (op.config.code === StdOpCode.workflow) {
      if (op.result.status === "success") {
        return {
          body: op.result.output,
          statusCode: 200,
        };
      } else {
        throw new Error("not implemented");
      }
    }
  }

  return {
    body: ops.map((op) => {
      let name = op.id.id;
      let opcode: string;
      if (op.config.code === StdOpCode.run) {
        opcode = "StepRun";
      } else if (op.config.code === StdOpCode.sleep) {
        opcode = "Sleep";

        const { wakeAt } = op.config.options ?? {};
        if (!(wakeAt instanceof Date)) {
          throw new Error("unreachable: wakeAt is not a Date");
        }
        name = wakeAt.toISOString();
      } else {
        throw new Error(`unexpected op code: ${op.config.code}`);
      }

      let data: unknown;
      if (op.result.status === "success") {
        data = op.result.output;
      } else {
        data = op.result.error.message;
      }

      return {
        displayName: op.id.id,
        id: op.id.hashed,
        op: opcode,
        name,
        data,
      };
    }),
    statusCode: 206,
  };
}
