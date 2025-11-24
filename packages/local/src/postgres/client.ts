import type pg from "pg";

import {
  BaseClient,
  type InputDefault,
  type SendSignalOpts,
  type StartData,
  type Workflow,
} from "@stepkit/sdk-tools";

import { Orchestrator } from "../common/orchestrator";
import type { EventQueueData, ExecQueueData } from "../common/queue";
import { DatabaseConnection, type DatabaseConfig } from "./db/connection";
import { ProductionDriver } from "./executionDriver";
import { PostgresQueue } from "./queue";
import { PostgresStateDriver } from "./stateDriver";

export type PostgresClientOptions = {
  autoMigrate?: boolean;
  connectionString: string;
  poolConfig?: pg.PoolConfig;
  queuePollInterval?: number;
};

const defaultMaxAttempts = 4;

export class PostgresClient extends BaseClient {
  db: DatabaseConnection;
  private orc: Orchestrator;

  constructor(options: PostgresClientOptions) {
    super();

    const dbConfig: DatabaseConfig = {
      connectionString: options.connectionString,
      poolConfig: options.poolConfig,
      autoMigrate: options.autoMigrate,
    };

    this.db = new DatabaseConnection(dbConfig);

    // Initialize will be called by start()
    const pool = this.db.getPool();
    const eventQueue = new PostgresQueue<EventQueueData>(pool, "event", {
      pollInterval: options.queuePollInterval,
    });
    const execQueue = new PostgresQueue<ExecQueueData>(pool, "exec", {
      pollInterval: options.queuePollInterval,
    });
    const stateDriver = new PostgresStateDriver(pool);
    const execDriver = new ProductionDriver(stateDriver);

    this.orc = new Orchestrator({
      eventQueue,
      stateDriver,
      execDriver,
      execQueue,
      workflows: this.workflows,
    });
  }

  async start(): Promise<void> {
    await this.db.initialize();
    this.orc.start();
  }

  stop(): void {
    this.orc.stop();
  }

  async close(): Promise<void> {
    this.stop();
    await this.db.close();
  }

  async invoke<TInput extends InputDefault, TOutput>(
    workflow: Workflow<TInput, TOutput>,
    data: TInput
  ): Promise<TOutput> {
    return this.orc.invoke(workflow, data);
  }

  async sendSignal(opts: SendSignalOpts): Promise<{ runId: string | null }> {
    return { runId: await this.orc.processIncomingSignal(opts) };
  }

  async startWorkflow<TInput extends InputDefault>(
    workflow: Workflow<TInput, any>,
    data: TInput
  ): Promise<StartData> {
    return this.orc.startWorkflow({
      data,
      maxAttempts: workflow.maxAttempts ?? defaultMaxAttempts,
      workflowId: workflow.id,
    });
  }
}
