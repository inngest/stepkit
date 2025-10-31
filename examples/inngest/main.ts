import express from "express";
import { serve } from "@stepkit/inngest";
import { workflow } from "./workflows";

const app = express();
app.use(express.json());

app.use("/api/inngest", serve([workflow]));

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
