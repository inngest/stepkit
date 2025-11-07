import express from "express";

import { serve } from "@stepkit/inngest-sdk-tools/express";

import { client } from "./client";
import { workflow } from "./workflows";

const port = process.env.PORT ?? 3000;
const appOrigin = `http://localhost:${String(port)}`;
const app = express();
app.use(express.json());

serve(client, [workflow], {
  app,
  appOrigin,
});

app.listen(port, () => {
  console.log(`Server running on ${appOrigin}`);
});
