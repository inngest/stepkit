import {
  StepState,
  StepStateItem,
  type BaseExeDriver,
  type Flow,
  type FoundStep,
} from './exeDriver';
import { executionLoop } from './executionLoop';

// temp
class RunState {
  private steps: Map<string, StepStateItem>;
  constructor() {
    this.steps = new Map();
  }

  getStep(id: string): StepStateItem | undefined {
    return this.steps.get(id);
  }
  setStep(id: string, item: StepStateItem): void {
    this.steps.set(id, item);
  }
}

export class Workflow<TOutput> {
  id: string;
  public readonly handler: (ctx: HandlerContext) => Promise<TOutput>;
  private readonly driver: BaseExeDriver;

  constructor({
    id,
    handler,
    driver,
  }: {
    id: string;
    handler: (ctx: HandlerContext) => Promise<TOutput>;
    driver: BaseExeDriver;
  }) {
    this.id = id;
    this.handler = handler;
    this.driver = driver;
  }

  async invoke(input: unknown): Promise<TOutput> {
    // TODO: Implement
    // this should be elsewhere:
    return await executionLoop<TOutput>({
      workflow: this,
      state: new RunState(),
      onStepsFound: this.driver.onStepsFound,
      getContext: this.driver.getContext,
    });
  }
}

export type Steps = {
  run: <T>(stepId: string, callback: () => Promise<T>) => Promise<T>;
};

export type HandlerContext = {
  step: Steps;
};
