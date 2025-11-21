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
  } else if (pkg.main?.startsWith("./dist/")) {
    pkg.main = pkg.main.replace("./dist/", "./");
  }
  if (pkg.module?.startsWith("./src/")) {
    pkg.module = "./main.js";
  } else if (pkg.module?.startsWith("./dist/")) {
    pkg.module = pkg.module.replace("./dist/", "./");
  }
  if (pkg.types?.startsWith("./src/")) {
    pkg.types = "./main.d.ts";
  } else if (pkg.types?.startsWith("./dist/")) {
    pkg.types = pkg.types.replace("./dist/", "./");
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
  if (typeof path !== "string") {
    return path;
  }

  //
  // Remove ./dist/ prefix since we're publishing from dist
  if (path.startsWith("./dist/")) {
    return path.replace("./dist/", "./");
  }

  //
  // Transform ./src/main.ts to conditional exports
  if (path.startsWith("./src/")) {
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

  return path;
}
