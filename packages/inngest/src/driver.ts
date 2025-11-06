import type { Workflow } from "@stepkit/core";
import type {
  InputDefault,
  StripStandardSchema,
} from "@stepkit/core/implementer";

export class InngestDriver {
  async invoke<TInput extends InputDefault, TOutput>(
    _workflow: Workflow<TInput, TOutput>,
    _input: StripStandardSchema<TInput>
  ): Promise<TOutput> {
    throw new Error("not implemented");
  }
}
