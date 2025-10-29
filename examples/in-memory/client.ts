import { OWClient } from "@open-workflow/core";
import { FileSystemDriver } from "@open-workflow/in-memory";

export const client = new OWClient({
  driver: new FileSystemDriver(),
});
