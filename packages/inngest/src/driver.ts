import type { GetStepTools } from "inngest";

import type { Workflow } from "@stepkit/core";
import type {
  Context,
  InputDefault,
  Step,
  StripStandardSchema,
} from "@stepkit/core/implementer";

export class InngestDriver {
  private inngestStep: GetStepTools<any>;

  constructor(inngestStep: GetStepTools<any>) {
    this.inngestStep = inngestStep;
  }

  async invoke<TInput extends InputDefault, TOutput>(
    workflow: Workflow<TInput, TOutput>,
    data: StripStandardSchema<TInput>
  ): Promise<TOutput> {
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
