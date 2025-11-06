import { z } from "zod";

export const commRequestSchema = z.object({
  ctx: z.object({
    attempt: z.number(),
    run_id: z.string(),
  }),
  steps: z.record(
    z.string(),
    z.union([
      z.object({ data: z.any() }),
      z.object({ error: z.any() }),
      z.null(),
    ])
  ),
});
export type CommRequest = z.infer<typeof commRequestSchema>;

export type CommResponse = {
  body: any;
  statusCode: number;
};
