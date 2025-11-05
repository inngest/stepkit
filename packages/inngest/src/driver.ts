import type { InputDefault } from "@stepkit/core/implementer";

export class InngestDriver {
  constructor() {}

  async invoke<TInput extends InputDefault, TOutput>(): Promise<TOutput> {
    throw new Error("not implemented");
  }
}
