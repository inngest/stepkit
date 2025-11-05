import { StepKitClient } from "@stepkit/core";
import { InngestDriver } from "@stepkit/inngest";

export const createClient = (inngestStep: any) => {
  return new StepKitClient({
    driver: new InngestDriver(inngestStep),
    id: "stepkit-inngest-example",
  });
};
