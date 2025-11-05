import type { GetStepTools } from "inngest";

import { NonRetryableError, type Workflow } from "@stepkit/core";
import type {
  Context,
  InputDefault,
  Step,
  StripStandardSchema,
} from "@stepkit/core/implementer";

class InvalidInputError extends NonRetryableError {
  constructor(issues: readonly any[]) {
    super("Invalid input", {
      cause: new Error(JSON.stringify(issues, null, 2)),
    });
    this.name = this.constructor.name;
  }
}

export class InngestDriver {
  private inngestStep: GetStepTools<any>;

  constructor(inngestStep: GetStepTools<any>) {
    this.inngestStep = inngestStep;
  }

  async invoke<TInput extends InputDefault, TOutput>(
    workflow: Workflow<TInput, TOutput>,
    data: StripStandardSchema<TInput>
  ): Promise<TOutput> {
    if (workflow.inputSchema !== undefined) {
      const result = await workflow.inputSchema["~standard"].validate(data);

      if (result.issues !== undefined && result.issues.length > 0) {
        throw new InvalidInputError(result.issues);
      }
    }

    const ctx: Context<TInput> = {
      ext: {},
      input: {
        data,
        ext: {},
        id: crypto.randomUUID(),
        name: "inngest",
        time: new Date(),
        type: "invoke",
      },
      runId: crypto.randomUUID(),
    };

    const step: Step = {
      ext: {},
      run: async <T>(stepId: string, handler: () => T): Promise<T> => {
        return (await this.inngestStep.run(stepId, handler)) as T;
      },
      sleep: async (stepId: string, duration: number): Promise<void> => {
        await this.inngestStep.sleep(stepId, duration);
      },
    };

    return await workflow.handler(ctx, step);
  }
}
