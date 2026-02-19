import type { ValidationAdapter } from "../types";

type ZodSchema<O = unknown> = { parse: (data: unknown) => O; _output: O };

/**
 * Adapter for Zod (https://zod.dev).
 * Import directly for tree-shaking: import { zodAdapter } from "prapti/adapters/zod"
 */
export const zodAdapter: ValidationAdapter<ZodSchema> = {
  parse: <O>(schema: ZodSchema<O>, data: unknown): O => schema.parse(data),
};
