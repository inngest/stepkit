import {
  NonRetriableError,
  referenceFunction,
  type ServeHandlerOptions,
} from "inngest";

import { InvalidInputError, NonRetryableError } from "@stepkit/core";
import {
  type Context,
  type ExtDefault,
  type InputDefault,
  type InputType,
  type SendSignalOpts,
  type Step,
  type WaitForSignalOpts,
  type Workflow,
} from "@stepkit/sdk-tools";

import {
  type InngestClient,
  type ReceivedEvent,
  type SentEvent,
  type StepExt,
} from "./client";
import { isNullish, isRecord } from "./utils";

export function inngestify(
  client: InngestClient,
  workflows: Workflow<any, any, ExtDefault, ExtDefault, StepExt>[]
): ServeHandlerOptions {
  const functions = workflows.map((workflow) => {
    const triggers = (workflow.triggers ?? []).map((trigger) => {
      if (trigger.type === "event") {
        return { event: trigger.name };
      }
      return { cron: trigger.schedule };
    });
    if (triggers.length === 0) {
      triggers.push({
        event: defaultEventName(client.inngest.id, workflow.id),
      });
    }

    return client.inngest.createFunction(
      { id: workflow.id },
      triggers,
      async (ctx) => {
        let time = new Date();
        if (ctx.event.ts !== undefined) {
          time = new Date(ctx.event.ts);
        }

        let type: InputType = "event";
        if (ctx.event.name === "inngest/function.invoked") {
          type = "invoke";
        } else if (ctx.event.name === "inngest/scheduled.timer") {
          type = "cron";
        }

        if (!isNullish(ctx.event.data) && !isRecord(ctx.event.data)) {
          throw new Error("unreachable: event data is not a record");
        }
        const data = ctx.event.data ?? {};
        delete data._inngest;

        const workflowCtx: Context = {
          runId: ctx.runId,
          input: {
            data,
            id: ctx.event.id ?? "unknown",
            ext: {},
            name: ctx.event.name,
            time,
            type,
          },
          ext: {},
        };

        const workflowStep: Step<StepExt> = {
          ext: {
            sendEvent: async (stepId: string, event: SentEvent) => {
              return ctx.step.sendEvent(stepId, event);
            },
            waitForEvent: async (
              stepId: string,
              opts: {
                event: string;
                if?: string;
                timeout: number | string | Date;
              }
            ): Promise<ReceivedEvent | null> => {
              const event = await ctx.step.waitForEvent(stepId, opts);
              if (event === null) {
                return null;
              }
              return {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                data: event.data ?? {},
                id: event.id ?? "",
                name: event.name,
                ts: event.ts ?? 0,
                v: event.v ?? undefined,
              };
            },
          },
          invokeWorkflow: async <TInput extends InputDefault, TOutput>(
            stepId: string,
            opts: {
              data?: TInput;
              timeout: number | Date;
              workflow: Workflow<TInput, TOutput>;
            }
          ) => {
            const result = await ctx.step.invoke(stepId, {
              data: opts.data,
              function: referenceFunction({
                appId: opts.workflow.client.id,
                functionId: opts.workflow.id,
              }),
              timeout: opts.timeout,
            });

            return result as TOutput;
          },
          run: <T>(stepId: string, handler: () => T) => {
            return ctx.step.run(stepId, async () => {
              try {
                return await handler();
              } catch (e) {
                if (e instanceof NonRetryableError) {
                  // Convert StepKit NonRetryableError to Inngest
                  // NonRetriableError
                  throw new NonRetriableError(e.message, { cause: e.cause });
                }
                throw e;
              }
            }) as Promise<T>;
          },
          sendSignal: async (stepId: string, opts: SendSignalOpts) => {
            await ctx.step.sendSignal(stepId, opts);

            return {
              // TODO: Implement this
              runId: "TODO",
            };
          },
          sleep: (stepId: string, duration: number) => {
            return ctx.step.sleep(stepId, duration);
          },
          sleepUntil: async (stepId: string, wakeAt: Date) => {
            await ctx.step.sleep(stepId, wakeAt.getTime() - Date.now());
          },
          waitForSignal: async <T>(
            stepId: string,
            opts: WaitForSignalOpts<T>
          ): Promise<{ data: T; signal: string } | null> => {
            const result = await ctx.step.waitForSignal(stepId, {
              ...opts,
              onConflict: "fail",
            });
            if (result === null) {
              return null;
            }

            if (opts.schema === undefined) {
              return {
                // @ts-expect-error - Type is unknown because there isn't a schema
                data: result.data,
                signal: result.signal,
              };
            }

            const validated = await opts.schema["~standard"].validate(
              result.data
            );
            if (validated.issues !== undefined) {
              throw new InvalidInputError(validated.issues);
            }
            return {
              data: validated.value,
              signal: result.signal,
            };
          },
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return workflow.handler(workflowCtx, workflowStep);
      }
    );
  });

  return {
    client: client.inngest,
    functions,
  };
}

export function defaultEventName(appId: string, workflowId: string): string {
  return `invoke/${appId}/${workflowId}`;
}
