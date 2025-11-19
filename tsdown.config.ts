import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: true,
  entry: [
    "packages/core/src/main.ts",
    "packages/sdk-tools/src/main.ts",
    "packages/local/src/main.ts",
    "packages/inngest/src/index.ts",
  ],
  format: ["cjs", "esm"],
  outDir: "dist",
  tsconfig: "tsconfig.build.json",
  target: "node20",
  platform: "neutral",
  sourcemap: true,
  failOnWarn: true, // keep the build as good we can
  minify: false, // let bundlers handle minification if they want it
  report: true,
  unbundle: true, // let bundlers handle bundling
  copy: ["package.json", "LICENSE.md", "README.md", "CHANGELOG.md"],
  skipNodeModulesBundle: true,
});
