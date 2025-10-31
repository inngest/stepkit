import { OpConfig } from "./types";
import z from "zod";
import { stdOpConfigSchemas } from "./types";

const opConfigSchema = z.union(Object.values(stdOpConfigSchemas));
export function parseOpConfig(
  config: OpConfig
): z.infer<typeof opConfigSchema> {
  return opConfigSchema.parse(config);
}
