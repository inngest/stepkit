import type { Request, Response } from "express";
import type express from "express";

import type { Workflow } from "@stepkit/core";
import type { ExtDefault } from "@stepkit/sdk-tools";

import type { Client } from "./client";
import { execute } from "./execute";
import type { StepExt } from "./executionDriver";
import { sync } from "./sync";
import { commRequestSchema } from "./types";

export function serve(
  client: Client,
  workflows: Workflow<any, any, ExtDefault, ExtDefault, StepExt>[],
  {
    app,
    appOrigin,
  }: {
    app: express.Express;
    appOrigin: string;
  }
): any {
  if (workflows.length === 0) {
    throw new Error("No workflows");
  }

  const inngestPath = "/api/inngest";
  app.use(inngestPath, async (req: Request, res: Response) => {
    if (req.method === "GET") {
      // TODO: implement
      return res.json({});
    }

    if (req.method === "POST") {
      if (workflows[0] === undefined) {
        throw new Error("unreachable: no workflows");
      }

      const body = commRequestSchema.parse(req.body);
      res.setHeader("content-type", "application/json");
      res.setHeader("x-inngest-sdk", "js:v0.0.0");
      const result = await execute(workflows[0], body);
      res.status(result.statusCode);
      return res.json(result.body);
    }

    if (req.method === "PUT") {
      await sync(client, workflows, {
        appOrigin,
        framework: "express",
        inngestPath,
      });
      return res.json({});
    }

    res.sendStatus(405);
  });
}
