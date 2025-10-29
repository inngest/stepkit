import { workflow1 } from "./workflows";

// Serve my client in some way
// fileSystemExpose(client, workflows)

const { runId } = await workflow1.invoke({ event: "my-event" });

app.post("/", async (req, res) => {
  const { event } = req.body;
  const { runId } = await workflow1.invoke({ event });
  res.json({ runId });
});

