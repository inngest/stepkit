import { toCloudflare } from "@stepkit/cloudflare";

import { workflow } from "./workflows";

type Env = {
  MY_WORKFLOW: Workflow;
};

export const MyWorkflow = toCloudflare(workflow);

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/favicon")) {
      return Response.json({}, { status: 404 });
    }

    // Get the status of an existing instance, if provided
    // GET /?instanceId=<id here>
    const id = url.searchParams.get("instanceId");
    if (id !== null) {
      const instance = await env.MY_WORKFLOW.get(id);
      return Response.json({
        status: await instance.status(),
      });
    }

    // Spawn a new instance and return the ID and status
    const instance = await env.MY_WORKFLOW.create({
      params: await req.json(),
    });
    const status = await instance.status();
    return Response.json(status.output);
  },
};
