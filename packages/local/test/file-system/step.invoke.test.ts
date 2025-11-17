import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { sleep } from "../../src/common/utils";
import { FileSystemClient } from "../../src/main";
import { stepInvokeWorkflowSuite } from "../common/step.invoke.suite";

stepInvokeWorkflowSuite(
  async () => {
    return new FileSystemClient({
      baseDir: await fs.mkdtemp(path.join(os.tmpdir(), "stepkit-test")),
    });
  },
  async (client) => {
    client.stop();
    // Give the file system time to finish any pending writes
    await sleep(100);
    await fs.rm(client.baseDir, { recursive: true, force: true });
  }
);
