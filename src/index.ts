/**
 * Prapti - Type-safe HTTP client with schema validation
 * "प्राप्ति" (Prapti) - Sanskrit for "fetch" or "obtain"
 */

export { adapters, zodAdapter, yupAdapter, valibotAdapter } from "./adapters";
export { ValidatedResponse } from "./response";
export { Prapti, prapti } from "./prapti";
export type { InferOutput, PraptiOptions, ValidateOptions, ValidationAdapter } from "./types";
