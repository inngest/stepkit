import express from "express";
import { serve } from "inngest/express";

import { inngestify } from "@stepkit/inngest";

import { client } from "./client";
import { processOrder } from "./workflows";

const app = express();
app.use(express.json());

app.use("/api/inngest", serve(inngestify(client, [processOrder])));

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${String(PORT)}`);
  console.log(
    `Inngest endpoint available at http://localhost:${String(PORT)}/api/inngest`
  );
});
