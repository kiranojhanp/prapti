/**
 * Prapti - Type-safe HTTP client with schema validation
 * "प्राप्ति" (Prapti) - Sanskrit for "fetch" or "obtain"
 */
export { zodAdapter } from "./adapters/zod";
export { yupAdapter } from "./adapters/yup";
export { valibotAdapter } from "./adapters/valibot";
export { ValidatedResponse } from "./response";
export { Prapti, prapti } from "./prapti";
export type {
  InferOutput,
  PraptiConfig,
  PraptiOptions,
  SerializationAdapter,
  ValidateOptions,
  ValidationAdapter,
} from "./types";
