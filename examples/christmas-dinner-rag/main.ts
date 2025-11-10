/* eslint-disable */
import "dotenv/config";

import express from "express";
import { serve } from "inngest/express";

import { inngestify } from "@stepkit/inngest";

import { client } from "./client";
import { christmasDinnerWorkflow } from "./workflow";

const app = express();
app.use(express.json());

app.use("/api/inngest", serve(inngestify(client, [christmasDinnerWorkflow])));

// Example endpoint to trigger the workflow
app.get("/plan-dinner", async (req, res) => {
  try {
    const { participants, cuisinePreference, dietaryRestrictions } = req.body;

    console.log("\n🎄 Triggering Christmas dinner planning workflow...\n");

    await client.startWorkflow(christmasDinnerWorkflow, {
      participants: participants || 6,
      cuisinePreference: cuisinePreference || "American",
      dietaryRestrictions,
    });

    res.json({
      success: true,
      message:
        "Christmas dinner planning started! Check the console for progress.",
    });
  } catch (error) {
    console.error("Error triggering workflow:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "🎄 Christmas Dinner RAG Workflow API",
    endpoints: {
      inngest: "/api/inngest",
      planDinner: "POST /plan-dinner",
    },
    example: {
      method: "GET",
      url: "/plan-dinner",
    },
  });
});

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`🎅 Server running on http://localhost:${String(PORT)}`);
  console.log(
    `📡 Inngest endpoint available at http://localhost:${String(PORT)}/api/inngest`
  );
  console.log(
    `\n💡 Open Inngest DevServer at http://localhost:8288 to trigger workflows`
  );
  console.log(
    `   Navigate to "christmas-dinner-planner" and use the example JSON payloads from README.md\n`
  );
});
