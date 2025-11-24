import { Client } from "pg";

import { sleep } from "../../src/common/utils";
import { PostgresClient } from "../../src/main";
import { parallelStepSuite } from "../common/parallelSteps";
import { stepInvokeWorkflowSuite } from "../common/step.invoke";
import { stepRunSuite } from "../common/step.run";
import { stepSleepSuite } from "../common/step.sleep";
import { stepWaitForSignalSuite } from "../common/step.waitForSignal";

// Get connection string from environment or use default for local testing
async function getConnectionString(): Promise<string> {
  const dbName = `stepkit_test_${crypto.randomUUID()}`.replace(/-/g, "_");
  try {
    const client = new Client({
      host: "localhost",
      port: 5432,
      user: "postgres",
      password: "postgres",
      database: "postgres", // Must connect to an existing DB first
    });
    await client.connect();
    await client.query(`CREATE DATABASE ${dbName}`);
    await client.end();
  } catch (error) {
    console.error("error creating database", error);
  }

  return `postgresql://postgres:postgres@localhost:5432/${dbName}`;
}

// Helper to clean up database between tests
async function cleanupDatabase(client: PostgresClient): Promise<void> {
  const { connectionString } = client.db.getPool().options;
  if (connectionString === undefined) {
    throw new Error("Connection string not found");
  }
  const dbName = connectionString.split("/").pop();
  console.log("dbName", dbName);
  if (dbName === undefined) {
    throw new Error("Database name not found");
  }

  // const pool = client.db.getPool();
  // await pool.query(
  //   "TRUNCATE runs, ops, waiting_invokes, waiting_signals, event_queue, exec_queue CASCADE"
  // );
  try {
    const client = new Client({
      host: "localhost",
      port: 5432,
      user: "postgres",
      password: "postgres",
      database: "postgres", // Must connect to an existing DB first
    });
    await client.connect();
    console.log("dbName", dbName);
    await client.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await client.end();
  } catch (error) {
    console.error("error creating database", error);
  }
}

stepInvokeWorkflowSuite(
  async () => {
    const client = new PostgresClient({
      connectionString: await getConnectionString(),
      autoMigrate: true,
    });
    await client.start();
    return client;
  },
  async (client) => {
    client.stop();
    // await cleanupDatabase(client);
    await client.close();
  }
);

stepRunSuite(
  async () => {
    const client = new PostgresClient({
      autoMigrate: true,
      connectionString: await getConnectionString(),
    });
    await client.start();
    return client;
  },
  async (client) => {
    client.stop();
    // await cleanupDatabase(client);
    await client.close();
  }
);
stepSleepSuite(
  async () => {
    const client = new PostgresClient({
      connectionString: await getConnectionString(),
      autoMigrate: true,
    });
    await client.start();
    return client;
  },
  async (client) => {
    client.stop();
    // await cleanupDatabase(client);
    await client.close();
  }
);

stepWaitForSignalSuite(
  async () => {
    const client = new PostgresClient({
      connectionString: await getConnectionString(),
      autoMigrate: true,
    });
    await client.start();
    return client;
  },
  async (client) => {
    client.stop();
    // await cleanupDatabase(client);
    await client.close();
  }
);

parallelStepSuite(
  async () => {
    const client = new PostgresClient({
      connectionString: await getConnectionString(),
      autoMigrate: true,
    });
    await client.start();
    return client;
  },
  async (client) => {
    client.stop();
    // await cleanupDatabase(client);
    await client.close();
  }
);
