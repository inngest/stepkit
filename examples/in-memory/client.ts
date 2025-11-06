import { StepKitClient } from "@stepkit/core";
import { InMemoryDriver } from "@stepkit/in-memory";

export const driver = new InMemoryDriver();

export const client = new StepKitClient({ driver, id: "my-app" });
