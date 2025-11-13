import { InngestClient } from "@stepkit/inngest";

export const client = new InngestClient({
  id: "stepkit-inngest-example",

  // Only need to set this when using the Inngest Dev Server
  mode: "dev",
});
