import { Client } from "pg";

import { PostgresClient } from "../../src/main";
import { parallelStepSuite } from "../common/parallelSteps";
import { stepInvokeWorkflowSuite } from "../common/step.invoke";
import { stepRunSuite } from "../common/step.run";
import { stepSleepSuite } from "../common/step.sleep";
import { stepWaitForSignalSuite } from "../common/step.waitForSignal";

async function getConnectionString(): Promise<string> {
  const host = "localhost";
  const port = 5432;
  const user = "postgres";
  const password = "postgres";
  const dbName = `stepkit_test_${crypto.randomUUID()}`.replace(/-/g, "_");
  try {
    const client = new Client({
      database: "postgres",
      host,
      password,
      port,
      user,
    });
    await client.connect();
    await client.query(`CREATE DATABASE ${dbName}`);
    await client.end();
  } catch (error) {
    console.error("error creating database", error);
  }

  return `postgresql://${user}:${password}@${host}:${port}/${dbName}`;
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
    await client.close();
  }
);
