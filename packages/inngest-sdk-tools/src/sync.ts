import type { ExtDefault, Workflow } from "@stepkit/sdk-tools";

import type { Client } from "./client";
import type { StepExt } from "./executionDriver";

type CronTrigger = {
  schedule: string;
};

type EventTrigger = {
  event: string;
};

type SyncBody = {
  appName: string;
  deployType: string;
  framework: string;
  functions: Fn[];
  sdk: string;
  url: string;
  v: string;
};

type Fn = {
  id: string;
  name: string;
  triggers: (EventTrigger | CronTrigger)[];
  steps: {
    step: {
      id: string;
      name: string;
      runtime: {
        type: "http";
        url: string;
      };
    };
  };
};

export async function sync(
  client: Client,
  workflows: Workflow<any, any, ExtDefault, ExtDefault, StepExt>[],
  {
    appOrigin,
    framework,
    inngestPath,
  }: { appOrigin: string; framework: string; inngestPath: string }
): Promise<void> {
  const url = `${appOrigin}${inngestPath}`;

  const functions: Fn[] = workflows.map((workflow) => {
    const triggers: (EventTrigger | CronTrigger)[] = (
      workflow.triggers ?? []
    ).map((trigger) => {
      if (trigger.type === "event") {
        return { event: trigger.name };
      } else {
        return { schedule: trigger.schedule };
      }
    });
    if (triggers.length === 0) {
      triggers.push({ event: "none" });
    }

    const fqId = `${client.id}-${workflow.id}`;
    return {
      id: fqId,
      name: workflow.id,
      steps: {
        step: {
          id: "step",
          name: "step",
          runtime: {
            type: "http",
            url: `${url}?fnId=${fqId}&stepId=step`,
          },
        },
      },
      triggers,
    } satisfies Fn;
  });

  const body: SyncBody = {
    appName: client.id,
    deployType: "ping",
    framework,
    functions,
    sdk: "stepkit-inngest-js:v0.0.0",
    url,
    v: "0.1",
  };

  // TODO: Don't hardcode
  const resp = await fetch("http://localhost:8288/fn/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (resp.status !== 200) {
    throw new Error(`Failed to sync app: ${resp.statusText}`);
  }
}
