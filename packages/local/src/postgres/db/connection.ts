import pg from "pg";

import { SCHEMA_SQL } from "./schema";

const { Pool } = pg;

export type DatabaseConfig = {
  connectionString: string;
  poolConfig?: pg.PoolConfig;
  autoMigrate?: boolean;
};

export class DatabaseConnection {
  private pool: pg.Pool;
  private initialized = false;

  constructor(private config: DatabaseConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      ...config.poolConfig,
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Test the connection
      const client = await this.pool.connect();
      client.release();
    } catch (error) {
      const err = error as Error & { code?: string };
      if (err.code === "ECONNREFUSED") {
        throw new Error(
          `Failed to connect to PostgreSQL at ${this.config.connectionString}. ` +
            "Is PostgreSQL running? You can start it with Docker: " +
            "docker run --name stepkit-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=stepkit_dev -p 5432:5432 -d postgres:16"
        );
      }
      throw new Error(`Failed to connect to PostgreSQL: ${err.message}`);
    }

    if (this.config.autoMigrate !== false) {
      await this.runMigrations();
    }

    this.initialized = true;
  }

  private async runMigrations(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(SCHEMA_SQL);
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to run database migrations: ${err.message}`);
    } finally {
      client.release();
    }
  }

  getPool(): pg.Pool {
    return this.pool;
  }

  async close(): Promise<void> {
    if (!this.pool.ended) {
      await this.pool.end();
    }
    this.initialized = false;
  }

  async query<T extends pg.QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<pg.QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async getClient(): Promise<pg.PoolClient> {
    return this.pool.connect();
  }
}
