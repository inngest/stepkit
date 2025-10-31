import { serve } from "inngest/express";
import { inngest } from "./client";
import { workflowFunction } from "./workflows";
import express from "express";

const app = express();

//
// Add body parsing middleware for JSON requests
app.use(express.json());

app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: [workflowFunction],
  })
);

//
// Simple endpoint to trigger the workflow
app.post("/trigger", async (req, res) => {
  try {
    await inngest.send({
      name: "workflow/run",
      data: {},
    });
    res.json({ success: true, message: "Workflow triggered" });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(
    `Inngest endpoint available at http://localhost:${PORT}/api/inngest`
  );
  console.log(`Trigger workflow with: POST http://localhost:${PORT}/trigger`);
});
