#!/usr/bin/env node

//
// updates package.json in dist/ to point to built files instead of source files
// Usage: node scripts/distPackage.js <package-dir>
// Example: node scripts/distPackage.js packages/core
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const packageDir = process.argv[2];

if (!packageDir) {
  console.error("Usage: node scripts/distPackage.js <package-dir>");
  process.exit(1);
}

const distPackageJsonPath = join(packageDir, "dist", "package.json");

try {
  const pkg = JSON.parse(readFileSync(distPackageJsonPath, "utf-8"));

  //
  // Update main, module, and types to point to built files
  if (pkg.main?.startsWith("./src/")) {
    pkg.main = "./main.cjs";
  }
  if (pkg.module?.startsWith("./src/")) {
    pkg.module = "./main.js";
  }
  if (pkg.types?.startsWith("./src/")) {
    pkg.types = "./main.d.ts";
  }

  //
  // Transform exports from source paths to built paths
  if (pkg.exports) {
    pkg.exports = transformExports(pkg.exports);
  }

  writeFileSync(distPackageJsonPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`✓ Updated ${distPackageJsonPath}`);
} catch (error) {
  console.error(`Failed to update ${distPackageJsonPath}:`, error.message);
  process.exit(1);
}

function transformExports(exports) {
  if (typeof exports === "string") {
    return transformPath(exports);
  }

  if (Array.isArray(exports)) {
    return exports.map(transformExports);
  }

  if (typeof exports === "object" && exports !== null) {
    const result = {};
    for (const [key, value] of Object.entries(exports)) {
      result[key] = transformExports(value);
    }
    return result;
  }

  return exports;
}

function transformPath(path) {
  if (typeof path !== "string" || !path.startsWith("./src/")) {
    return path;
  }

  //
  // Transform ./src/main.ts to conditional exports
  const filename = path.replace("./src/", "").replace(/\.ts$/, "");

  return {
    types: {
      import: `./${filename}.d.ts`,
      require: `./${filename}.d.cts`,
    },
    import: `./${filename}.js`,
    require: `./${filename}.cjs`,
  };
}
