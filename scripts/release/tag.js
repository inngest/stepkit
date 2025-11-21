#!/usr/bin/env node

import path from "path";
import { fileURLToPath } from "url";
import { exec as rawExec } from "@actions/exec";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const exec = async (...args) => {
  const exitCode = await rawExec(...args);
  if (exitCode !== 0) {
    throw new Error(`Command exited with ${exitCode}`);
  }
};

const repoRootDir = path.join(__dirname, "..", "..");

(async () => {
  //
  // Tag and push the release commit
  console.log('running "changeset tag" to tag the release commit');
  await exec("changeset", ["tag"], { cwd: repoRootDir });

  console.log("pushing git tags to origin");
  await exec("git", ["push", "--follow-tags"]);
})();
