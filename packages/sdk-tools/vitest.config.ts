import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@stepkit/core/implementer": `${rootDir}/packages/core/src/implementer.ts`,
      "@stepkit/core": `${rootDir}/packages/core/src/main.ts`,
      "@stepkit/sdk-tools": `${rootDir}/packages/sdk-tools/src/main.ts`,
      "@stepkit/local": `${rootDir}/packages/local/src/main.ts`,
      "@stepkit/inngest": `${rootDir}/packages/inngest/src/main.ts`,
    },
    conditions: ["source"],
  },
});
