import { StepKitClient } from "@stepkit/core";
import { InngestDriver } from "@stepkit/inngest";

export const client = new StepKitClient({
  driver: new InngestDriver(),
  id: "stepkit-inngest-example",
});
