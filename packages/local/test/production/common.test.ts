import { sleep } from "../../src/common/utils";
import { ProductionClient } from "../../src/main";
import { parallelStepSuite } from "../common/parallelSteps";
import { stepInvokeWorkflowSuite } from "../common/step.invoke";
import { stepRunSuite } from "../common/step.run";
import { stepSleepSuite } from "../common/step.sleep";
import { stepWaitForSignalSuite } from "../common/step.waitForSignal";

// Get connection string from environment or use default for local testing
const getConnectionString = (): string => {
  return (
    process.env.POSTGRES_TEST_URL ||
    "postgresql://postgres:postgres@localhost:5432/stepkit_test"
  );
};

// Helper to clean up database between tests
const cleanupDatabase = async (client: ProductionClient): Promise<void> => {
  const pool = (client as any).db.getPool();
  await pool.query("TRUNCATE runs, ops, waiting_invokes, waiting_signals, event_queue, exec_queue CASCADE");
};

stepInvokeWorkflowSuite(
  async () => {
    const client = new ProductionClient({
      connectionString: getConnectionString(),
      autoMigrate: true,
    });
    await client.start();
    return client;
  },
  async (client) => {
    client.stop();
    await cleanupDatabase(client);
    await client.close();
    // Give the database time to finish cleanup
    await sleep(100);
  }
);

stepRunSuite(
  async () => {
    const client = new ProductionClient({
      connectionString: getConnectionString(),
      autoMigrate: true,
    });
    await client.start();
    return client;
  },
  async (client) => {
    client.stop();
    await cleanupDatabase(client);
    await client.close();
    // Give the database time to finish cleanup
    await sleep(100);
  }
);

stepSleepSuite(
  async () => {
    const client = new ProductionClient({
      connectionString: getConnectionString(),
      autoMigrate: true,
    });
    await client.start();
    return client;
  },
  async (client) => {
    client.stop();
    await cleanupDatabase(client);
    await client.close();
    // Give the database time to finish cleanup
    await sleep(100);
  }
);

stepWaitForSignalSuite(
  async () => {
    const client = new ProductionClient({
      connectionString: getConnectionString(),
      autoMigrate: true,
    });
    await client.start();
    return client;
  },
  async (client) => {
    client.stop();
    await cleanupDatabase(client);
    await client.close();
    // Give the database time to finish cleanup
    await sleep(100);
  }
);

parallelStepSuite(
  async () => {
    const client = new ProductionClient({
      connectionString: getConnectionString(),
      autoMigrate: true,
    });
    await client.start();
    return client;
  },
  async (client) => {
    client.stop();
    await cleanupDatabase(client);
    await client.close();
    // Give the database time to finish cleanup
    await sleep(100);
  }
);
