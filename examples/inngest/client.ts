import { OWClient } from "@open-workflow/core";
import { InngestDriver } from "@open-workflow/inngest";

export const client = new OWClient({
  driver: new InngestDriver(),
});
