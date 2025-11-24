import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/main.ts", "src/implementer.ts"],
  format: ["cjs", "esm"],
  outDir: "dist",
  tsconfig: "tsconfig.build.json",
  target: "node20",
  platform: "neutral",
  sourcemap: true,
  failOnWarn: true,
  minify: false,
  report: true,
  unbundle: true,
  copy: [
    "package.json",
    "AGENTS.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "LICENSE.md",
  ],
  skipNodeModulesBundle: true,
});
