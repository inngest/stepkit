import { describe, expect, it, onTestFinished, vi } from "vitest";

import { NonRetryableError, type BaseClient } from "@stepkit/sdk-tools";

import { expectError } from "../utils";

export function stepRunSuite<TClient extends BaseClient>(
  createClient: () => TClient | Promise<TClient>,
  cleanup: (client: TClient) => void | Promise<void>
): void {
  describe("step.run", () => {
    it("success", async () => {
      const client = await createClient();
      onTestFinished(async () => cleanup(client));

      const counters = {
        top: 0,
        getGreeting: 0,
        getName: 0,
        bottom: 0,
      };
      const workflow = client.workflow(
        { id: "workflow" },
        async (ctx, step) => {
          counters.top++;

          const greeting = await step.run("get-greeting", async () => {
            counters.getGreeting++;
            return "Hello";
          });

          const name = await step.run("get-name", async () => {
            counters.getName++;
            return "Alice";
          });
          counters.bottom++;
          return `${greeting}, ${name}!`;
        }
      );

      await workflow.start({ msg: "hi" });
      await vi.waitFor(() => {
        expect(counters).toEqual({
          top: 3,
          getGreeting: 1,
          getName: 1,
          bottom: 1,
        });
      });
    });

    it("successful retry", async () => {
      const client = await createClient();
      onTestFinished(async () => cleanup(client));

      const counters = {
        top: 0,
        insideStep: 0,
        bottom: 0,
      };
      const workflow = client.workflow({ id: "workflow" }, async (_, step) => {
        counters.top++;

        const output = await step.run("a", async () => {
          counters.insideStep++;
          if (counters.insideStep === 1) {
            throw new Error("oh no");
          }
          return "hi";
        });

        counters.bottom++;
        return output;
      });

      await workflow.start({});

      await vi.waitFor(() => {
        expect(counters).toEqual({
          top: 3,
          insideStep: 2,
          bottom: 1,
        });
      });
    });

    it("fail", async () => {
      const client = await createClient();
      onTestFinished(async () => cleanup(client));

      class FooError extends Error {
        constructor(message: string, options?: ErrorOptions) {
          super(message, options);
          this.name = "FooError";
        }
      }

      class BarError extends Error {
        constructor(message: string, options?: ErrorOptions) {
          super(message, options);
          this.name = "BarError";
        }
      }

      let errorInsideWorkflow: Error | undefined;
      const counters = {
        top: 0,
        insideStep: 0,
        catch: 0,
        bottom: 0,
      };
      const workflow = client.workflow(
        { id: "workflow", maxAttempts: 2 },
        async (_, step) => {
          counters.top++;

          try {
            await step.run("a", async () => {
              counters.insideStep++;
              throw new FooError("oh no", { cause: new BarError("the cause") });
            });
          } catch (e) {
            counters.catch++;
            errorInsideWorkflow = e as Error;
            throw e;
          }

          counters.bottom++;
          return "hi";
        }
      );

      await workflow.start({});

      await vi.waitFor(() => {
        expect(counters).toEqual({
          top: 4,
          insideStep: 2,
          catch: 2,
          bottom: 0,
        });
      });

      // Actual type is `Error`, regardless of the type when thrown. This is
      // because of JSON serialization
      expect(errorInsideWorkflow).toBeInstanceOf(Error);

      expectError(errorInsideWorkflow, {
        message: "oh no",
        name: "FooError",
        cause: {
          message: "the cause",
          name: "BarError",
          stack: expect.any(String),
        },
      });
    });

    it("NonRetryableError", async () => {
      const client = await createClient();
      onTestFinished(async () => cleanup(client));

      class MyError extends Error {
        constructor(message: string, options?: ErrorOptions) {
          super(message, options);
          this.name = this.constructor.name;
        }
      }

      const counters = {
        top: 0,
        insideStep: 0,
        bottom: 0,
      };
      const workflow = client.workflow(
        { id: "workflow", maxAttempts: 2 },
        async (_, step) => {
          counters.top++;

          await step.run("a", async () => {
            counters.insideStep++;
            throw new NonRetryableError("oh no", {
              cause: new MyError("the cause"),
            });
          });

          counters.bottom++;
        }
      );

      await workflow.start({});

      await vi.waitFor(() => {
        expect(counters).toEqual({
          top: 1,
          insideStep: 1,
          bottom: 0,
        });
      });
    });

    it("duplicate step ID", async () => {
      // Duplicate step IDs are treated as different steps

      const client = await createClient();
      onTestFinished(async () => cleanup(client));

      const counters = {
        top: 0,
        first: 0,
        second: 0,
        bottom: 0,
      };
      const outputs: Record<string, unknown> = {
        first: undefined,
        second: undefined,
      };
      const workflow = client.workflow(
        { id: "workflow" },
        async (ctx, step) => {
          counters.top++;

          outputs.first = await step.run("duplicate", async () => {
            counters.first++;
            return "first";
          });

          outputs.second = await step.run("duplicate", async () => {
            counters.second++;
            return "second";
          });

          counters.bottom++;
        }
      );

      await workflow.start({});

      await vi.waitFor(() => {
        expect(counters).toEqual({
          top: 3,
          first: 1,
          second: 1,
          bottom: 1,
        });
      });
      expect(outputs).toEqual({
        first: "first",
        second: "second",
      });
    });
  });
}
