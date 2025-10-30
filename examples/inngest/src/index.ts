import express from "express";
import { serve } from "inngest/express";
import { inngest } from "./inngest/client.js";
import { functions, driver } from "./inngest/workflows.js";

const app = express();
const port = 3000;

app.use(express.json({ limit: "5mb" }));

//
// Serve Inngest functions
app.use("/api/inngest", serve({ client: inngest, functions }));

//
// Example endpoints to trigger workflows
app.post("/api/workflows/greeting", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const result = await driver.invokeWorkflow("greeting-workflow", { name });

    res.json({
      message: "Workflow invoked successfully",
      runId: result.id,
    });
  } catch (error) {
    console.error("Error invoking workflow:", error);
    res.status(500).json({ error: "Failed to invoke workflow" });
  }
});

app.post("/api/workflows/calculation", async (req, res) => {
  try {
    const { x, y } = req.body;

    if (typeof x !== "number" || typeof y !== "number") {
      return res.status(400).json({ error: "x and y must be numbers" });
    }

    const result = await driver.invokeWorkflow("calculation-workflow", {
      x,
      y,
    });

    res.json({
      message: "Workflow invoked successfully",
      runId: result.id,
    });
  } catch (error) {
    console.error("Error invoking workflow:", error);
    res.status(500).json({ error: "Failed to invoke workflow" });
  }
});

//
// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`\n🚀 Server running on http://localhost:${port}`);
  console.log(`📡 Inngest endpoint: http://localhost:${port}/api/inngest`);
  console.log(`\nℹ️  To use this example:`);
  console.log(`   1. Run the Inngest Dev Server: npx inngest-cli@latest dev`);
  console.log(`   2. Visit http://localhost:8288 to see your functions`);
  console.log(`   3. Trigger workflows via POST requests:`);
  console.log(`      - POST http://localhost:${port}/api/workflows/greeting`);
  console.log(`        Body: { "name": "Alice" }`);
  console.log(
    `      - POST http://localhost:${port}/api/workflows/calculation`,
  );
  console.log(`        Body: { "x": 5, "y": 3 }\n`);
});
