import { ProductionClient } from "@stepkit/local";

// Get connection string from environment or use default for local development
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/stepkit_dev";

export const client = new ProductionClient({
  connectionString,
  queuePollInterval: 100, // Poll every 100ms (default)
  autoMigrate: true, // Automatically create schema on startup
});
