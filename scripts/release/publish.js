#!/usr/bin/env node

import path from "path";
import { exec as rawExec, getExecOutput } from "@actions/exec";

const name = process.env.npm_package_name;
const version = process.env.npm_package_version;
const registry = process.env.npm_package_publishConfig_registry;
console.log("version:", version);
const tag = `${name}@${version}`;
console.log("tag:", tag);

const [, tagEnd = ""] = version.split("-");
const distTag = tagEnd.split(".")[0] || "latest";
console.log("distTag:", distTag);

console.log("process.cwd()", process.cwd());

const packageRootDir = process.cwd();
console.log("package root:", packageRootDir);
const repoRootDir = path.join(packageRootDir, "..", "..");
console.log("repo root:", repoRootDir);
const distDir = process.env.DIST_DIR
  ? path.join(packageRootDir, process.env.DIST_DIR)
  : packageRootDir;
console.log("dist dir:", distDir);
process.chdir(packageRootDir);

const exec = async (...args) => {
  const exitCode = await rawExec(...args);
  if (exitCode !== 0) {
    throw new Error(`Command exited with ${exitCode}`);
  }
};

(async () => {
  const { exitCode, stderr } = await getExecOutput(
    `git`,
    ["ls-remote", "--exit-code", "origin", "--tags", `refs/tags/${tag}`],
    {
      ignoreReturnCode: true,
    }
  );

  if (exitCode === 0) {
    console.log(
      `Action is not being published because version ${tag} is already published`
    );
    return;
  }

  if (exitCode !== 2) {
    throw new Error(`git ls-remote exited with ${exitCode}:\n${stderr}`);
  }

  //
  // Get current latest version
  let latestVersion;

  const {
    exitCode: latestCode,
    stdout: latestStdout,
    stderr: latestStderr,
  } = await getExecOutput("npm", ["dist-tag", "ls"], {
    ignoreReturnCode: true,
  }); 

  if (latestCode !== 0) {
    //
    // It could be a non-zero code if the package was never published before
    const notFoundMsg = "is not in this registry";

    if (
      latestStdout.includes(notFoundMsg) ||
      latestStderr.includes(notFoundMsg)
    ) {
      console.log(
        "npm dist-tag ls failed but it's okay; package hasn't been published yet"
      );
    } else {
      throw new Error(
        `npm dist-tag ls exited with ${latestCode}:\n${latestStderr}`
      );
    }
  } else {
    latestVersion = latestStdout
      ?.split("\n")
      ?.find((line) => line.startsWith("latest: "))
      ?.split(" ")[1];

    if (!latestVersion) {
      throw new Error(`Could not find "latest" dist-tag in:\n${latestStdout}`);
    }
  }

  console.log("latestVersion:", latestVersion);

  //
  // Release to npm
  await exec("npm", ["config", "set", "git-tag-version", "false"], {
    cwd: distDir,
  });

  console.log("publishing", tag, "to dist tag:", distTag);

  //
  // Only use --provenance in CI environments with OIDC support
  const publishArgs = ["publish", "--tag", distTag, "--access", "public"];
  if (process.env.CI) {
    publishArgs.push("--provenance");
  }


  const {
    exitCode: publishExitCode,
    stdout: publishStdout,
    stderr: publishStderr,
  } = await getExecOutput("npm", publishArgs, {
    cwd: distDir,
    ignoreReturnCode: true,
  });

  if (publishExitCode !== 0) {
    //
    // It could be a non-zero code if the package was already published by
    // another action or human. If this is the case, we should not fail the
    // action.
    const duplicatePublishMsg =
      "cannot publish over the previously published versions";

    if (
      publishStdout.includes(duplicatePublishMsg) ||
      publishStderr.includes(duplicatePublishMsg)
    ) {
      console.log("npm publish failed but it's okay; it's already published");

      return;
    }

    throw new Error(`npm publish exited with ${publishExitCode}`);
  }

  console.log("Publish successful");
})();
