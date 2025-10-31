import { OpResult, StdOpcode, Workflow } from "@stepkit/core";
import type { Request, Response } from "express";
import { z } from "zod";

async function sync() {
  const body = {
    url: "http://localhost:3000/api/inngest",
    deployType: "ping",
    framework: "express",
    appName: "my-app",
    functions: [
      {
        id: "my-app-fn-1",
        name: "fn-1",
        triggers: [
          {
            event: "event-1",
          },
        ],
        steps: {
          step: {
            id: "step",
            name: "step",
            runtime: {
              type: "http",
              url: "http://localhost:3000/api/inngest?fnId=my-app-fn-1&stepId=step",
            },
          },
        },
      },
    ],
    sdk: "js:v3.44.1",
    v: "0.1",
    capabilities: {
      trust_probe: "v1",
      connect: "v1",
    },
  };

  const resp = await fetch("http://localhost:8288/fn/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (resp.status !== 200) {
    throw new Error(`Failed to sync app: ${resp.statusText}`);
  }
}

const commRequestBody = z.object({
  ctx: z.object({
    run_id: z.string(),
  }),
  steps: z.record(
    z.string(),
    z.union([
      z.object({ data: z.any() }),
      z.object({ error: z.any() }),
      z.null(),
    ])
  ),
});

type CommResponse = {
  body: any;
  statusCode: number;
};

async function execute(
  workflow: Workflow<any, any>,
  req: z.infer<typeof commRequestBody>
): Promise<CommResponse> {
  for (const [stepId, stepResult] of Object.entries(req.steps)) {
    let opResult: OpResult;
    if (stepResult === null) {
      opResult = {
        config: { code: "unknown" },
        id: { hashed: stepId, id: stepId, index: 0 },
        result: {
          status: "success",
          output: undefined,
        },
      };
    } else if ("data" in stepResult) {
      opResult = {
        config: { code: "unknown" },
        id: { hashed: stepId, id: stepId, index: 0 },
        result: {
          status: "success",
          output: stepResult.data,
        },
      };
    } else {
      opResult = {
        config: { code: "unknown" },
        id: { hashed: stepId, id: stepId, index: 0 },
        result: {
          status: "error",
          error: stepResult.error,
        },
      };
    }
    workflow.driver.state.setOp(
      { runId: req.ctx.run_id, hashedOpId: stepId },
      opResult
    );
  }
  const ops = await workflow.driver.execute(workflow, req.ctx.run_id);
  if (ops.length === 1) {
    const op = ops[0];
    if (op.config.code === StdOpcode.workflow) {
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
      let displayName = op.id.id;
      let name = op.id.id;
      let opcode: string;
      let opts = {};
      if (op.config.code === StdOpcode.stepRun) {
        opcode = "StepRun";
      } else if (op.config.code === StdOpcode.stepSleep) {
        opcode = "Sleep";

        // @ts-expect-error - TODO: fix this
        name = op.config.options?.wakeupAt?.toISOString();
      } else {
        throw new Error(`unexpected op code: ${op.config.code}`);
      }

      let data: any;
      if (op.result.status === "success") {
        data = op.result.output;
      } else {
        data = op.result.error.message;
      }

      return {
        displayName,
        id: op.id.hashed,
        op: opcode,
        name,
        opts,
        data,
      };
    }),
    statusCode: 206,
  };
}

export function serve(workflows: Workflow<any, any>[]): any {
  return async (req: Request, res: Response) => {
    if (req.method == "GET") {
      return res.json({});
    }

    if (req.method == "POST") {
      const body = commRequestBody.parse(req.body);
      res.setHeader("content-type", "application/json");
      res.setHeader("x-inngest-sdk", "js:v0.0.0");
      const result = await execute(workflows[0], body);
      res.status(result.statusCode);
      return res.json(result.body);
    }

    if (req.method == "PUT") {
      await sync();
      return res.json({});
    }

    res.sendStatus(405);
  };
}
