import { OWClient } from "@stepkit/core";
import { InMemoryDriver } from "@stepkit/in-memory";

export const client = new OWClient({
  driver: new InMemoryDriver(),
});
