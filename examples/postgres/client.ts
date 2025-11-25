import { PostgresClient } from "@stepkit/local";

// Get connection string from environment or use default for local development
const connectionString =
  "postgresql://postgres:postgres@localhost:5432/stepkit_dev";

export const client = new PostgresClient({
  autoMigrate: true,
  connectionString,
  queuePollInterval: 100,
});
