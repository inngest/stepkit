import express from "express";
import { serve } from "inngest/express";

import { inngest } from "./inngest";
import { workflowFunction } from "./workflows";

const app = express();

app.use(express.json());

app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: [workflowFunction],
  })
);

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(
    `Inngest endpoint available at http://localhost:${PORT}/api/inngest`
  );
});
