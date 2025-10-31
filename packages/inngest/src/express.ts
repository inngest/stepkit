import { StdOpcode, Workflow } from "@open-workflow/core";
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

type CommResponse = {
  body: any;
  statusCode: number;
};

async function execute(
  workflow: Workflow<any, any>,
  runId: string
): Promise<CommResponse> {
  const ops = await workflow.driver.execute(workflow, runId);
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
      let opcode: string;
      if (op.config.code === StdOpcode.stepRun) {
        opcode = "StepRun";
      } else if (op.config.code === StdOpcode.stepSleep) {
        opcode = "Sleep";
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
        id: op.id.hashed,
        op: opcode,
        name: op.id.id,
        opts: {},
        data: data,
      };
    }),
    statusCode: 206,
  };
}

const commRequestBody = z.object({
  ctx: z.object({
    run_id: z.string(),
  }),
});

export function serve(workflows: Workflow<any, any>[]): any {
  return async (req: Request, res: Response) => {
    if (req.method == "GET") {
      return res.json({});
    }

    if (req.method == "POST") {
      const body = commRequestBody.parse(req.body);
      res.setHeader("content-type", "application/json");
      res.setHeader("x-inngest-sdk", "js:v0.0.0");
      const result = await execute(workflows[0], body.ctx.run_id);
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
