import { OWClient } from "@open-workflow/core";
import { InngestDriver } from "@open-workflow/inngest";
import { inngest } from "./client";

//
// The InngestDriver offloads workflow orchestration to Inngest.
export const workflowFunction = inngest.createFunction(
  { id: "my-workflow" },
  { event: "workflow/run" },
  async ({ step, event, runId }) => {
    const driver = new InngestDriver(step, runId);
    const client = new OWClient({ driver });

    const workflow = client.workflow(
      { id: "my-workflow" },
      async ({ step }) => {
        console.log("workflow: top");

        const greeting = await step.run("get-greeting", async () => {
          console.log("get-greeting: executing");
          return "Hello";
        });

        const name = await step.run("get-name", async () => {
          console.log("get-name: executing");
          return "Alice";
        });

        console.log("workflow: bottom");

        return `${greeting}, ${name}!`;
      }
    );

    const result = await workflow.invoke({});
    console.log("workflow result:", result);

    return result;
  }
);
