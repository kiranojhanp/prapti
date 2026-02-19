/**
 * Validation adapter interface for different schema libraries
 * Supports Zod, Valibot, Yup, Joi, and other validation libraries
 */
export interface ValidationAdapter<TSchema = unknown> {
  /**
   * Parse and validate data against the provided schema.
   * Returns `unknown`; callers derive the output type via `InferOutput<TSchema>`.
   * @param schema - The validation schema
   * @param data - Data to validate
   * @returns Validated data (untyped — use InferOutput<TSchema> at call sites)
   * @throws Validation error if data doesn't match schema
   */
  parse(schema: TSchema, data: unknown): unknown;
}

/**
 * Type helper to infer output type from various schema formats.
 *
 * Convention coverage:
 *  - Zod:     schema._output
 *  - Yup:     schema.__outputType (via InferType)
 *  - Valibot: schema["~standard"].types.output  (Standard Schema spec)
 *  - Fallback: unknown
 */
export type InferOutput<T> =
  // Zod: ZodType exposes _output
  T extends { _output: infer U }
    ? U
    // Yup: ObjectSchema exposes __outputType
    : T extends { __outputType: infer U }
    ? U
    // Standard Schema spec (Valibot ≥ 0.31, ArkType, others)
    : T extends { readonly "~standard": { readonly types?: { readonly output?: infer U } } }
    ? U
    // Function-based schemas
    : T extends (...args: any[]) => infer U
    ? U
    // Fallback
    : unknown;

/**
 * Extended fetch options with optional validation schemas
 * Maintains compatibility with native RequestInit while adding validation
 */
export interface PraptiOptions<
  TRequestSchema = unknown,
  TResponseSchema = unknown,
  TRequestHeadersSchema = unknown,
  TResponseHeadersSchema = unknown
> extends Omit<RequestInit, "body" | "headers"> {
  /** Request body — accepts native BodyInit types or a plain object/array (requires requestSchema to serialize) */
  body?: BodyInit | null | Record<string, unknown> | unknown[];
  /** Request headers - can be HeadersInit or plain object when using requestHeadersSchema */
  headers?: HeadersInit | Record<string, unknown>;
  /** Schema to validate request body against */
  requestSchema?: TRequestSchema;
  /** Schema to validate response data against */
  responseSchema?: TResponseSchema;
  /** Schema to validate request headers against */
  requestHeadersSchema?: TRequestHeadersSchema;
  /** Schema to validate response headers against */
  responseHeadersSchema?: TResponseHeadersSchema;
}
