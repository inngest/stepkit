import { OWClient } from "@stepkit/core";
import { InngestDriver } from "@stepkit/inngest";

export const client = new OWClient({
  driver: new InngestDriver(),
});
