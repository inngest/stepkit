import type { StepStateItem } from "@open-workflow/core";
import { BaseExecutionDriver } from "@open-workflow/core";

class State {
  private steps: Map<string, StepStateItem>;
  constructor() {
    this.steps = new Map();
  }

  getStep(id: string): StepStateItem | undefined {
    if (this.steps.has(id)) {
      return this.steps.get(id);
    }
    return undefined;
  }
  setStep(id: string, state: StepStateItem): void {
    this.steps.set(id, state);
  }
}

export class InMemoryDriver extends BaseExecutionDriver {
  constructor() {
    super(new State());
  }
}
