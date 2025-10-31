import {
  StepState,
  StepStateItem,
  type BaseExecutionDriver,
  type Flow,
  type FoundStep,
} from './baseExecutionDriver';

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

export class Workflow<TContext, TOutput> {
  id: string;
  public readonly handler: (ctx: TContext) => Promise<TOutput>;
  private readonly driver: BaseExecutionDriver;

  constructor({
    id,
    handler,
    driver,
  }: {
    id: string;
    handler: (ctx: TContext) => Promise<TOutput>;
    driver: BaseExecutionDriver;
  }) {
    this.id = id;
    this.handler = handler;
    this.driver = driver;
  }

  async invoke(input: unknown): Promise<TOutput> {
    throw new Error("not implemented");
    // TODO: Implement
    // this should be elsewhere:
    // return await executionLoop<TOutput>({
    //   workflow: this,
    //   state: new RunState(),
    //   onStepsFound: this.driver.onStepsFound,
    //   getContext: this.driver.getContext,
    // });
  }
}

export type Steps = {
  run: <T>(stepId: string, callback: () => Promise<T>) => Promise<T>;
};

