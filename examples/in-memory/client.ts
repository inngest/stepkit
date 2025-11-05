import { StepKitClient } from "@stepkit/core";
import { InMemoryDriver } from "@stepkit/in-memory";

export const client = new StepKitClient({
  driver: new InMemoryDriver(),
  id: "my-app",
});
