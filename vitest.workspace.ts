import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "core",
      include: ["packages/core/**/*.test.ts"],
      environment: "node",
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "sdk-tools",
      include: ["packages/sdk-tools/**/*.test.ts"],
      environment: "node",
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "local",
      include: ["packages/local/**/*.test.ts"],
      environment: "node",
    },
  },
  {
    extends: "./packages/inngest/vitest.config.ts",
    test: {
      name: "inngest",
      include: ["packages/inngest/**/*.test.ts"],
      environment: "node",
    },
  },
]);
