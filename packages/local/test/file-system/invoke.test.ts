import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, onTestFinished } from "vitest";
import z from "zod";

import { FileSystemClient } from "../../src/main";
import { expectError } from "../utils";

describe("invoke", () => {
  it("invalid input", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "stepkit-test-"));
    onTestFinished(async () => fs.rm(baseDir, { recursive: true }));
    const client = new FileSystemClient({ baseDir });
    onTestFinished(() => client.stop());

    let counter = 0;
    const workflow = client.workflow(
      {
        id: "workflow",
        inputSchema: z.object({ name: z.string() }),
      },
      async () => {
        counter++;
      }
    );

    let error: unknown;
    try {
      // @ts-expect-error - Intentional invalid input
      await client.invoke(workflow, { name: 1 });
    } catch (e) {
      error = e;
    }

    expectError(error, {
      message: "Invalid input",
      name: "InvalidInputError",
      cause: {
        message: JSON.stringify(
          [
            {
              expected: "string",
              code: "invalid_type",
              path: ["name"],
              message: "Invalid input: expected string, received number",
            },
          ],
          null,
          2
        ),
        name: "Error",
        stack: expect.any(String),
      },
    });
    expect(counter).toEqual(0);
  });

  it("nested steps", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "stepkit-test-"));
    onTestFinished(async () => fs.rm(baseDir, { recursive: true }));
    const client = new FileSystemClient({ baseDir });
    onTestFinished(() => client.stop());

    const counters = {
      top: 0,
      a: 0,
      b: 0,
      bottom: 0,
    };
    const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
      counters.top++;

      await step.run("a", async () => {
        counters.a++;
        await step.run("b", async () => {
          counters.b++;
        });
      });

      counters.bottom++;
    });

    let error: unknown;
    try {
      await client.invoke(workflow, {});
    } catch (e) {
      error = e;
    }

    expect(counters).toEqual({
      top: 1,
      a: 1,
      b: 0,
      bottom: 0,
    });
    expectError(error, {
      message: "Step is nested inside another step: b inside a",
      name: "NestedStepError",
    });
  });
});
