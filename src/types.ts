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
 * Serialization adapter for transforming request/response payloads.
 */
export interface SerializationAdapter {
  /** Serialize a payload into a transport-friendly form. */
  stringify(value: unknown): string;
  /** Deserialize a payload from the transport format. */
  parse(value: string): unknown;
  /** Optional content-type check for JSON payloads. */
  isJsonContentType?: (contentType: string | null) => boolean;
}

/**
 * Optional configuration for serialization and header validation.
 */
export interface PraptiConfig {
  serializer?: SerializationAdapter;
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
 * Nested validation schema options grouped by HTTP direction
 */
export interface ValidateOptions<
  TRequestBodySchema = unknown,
  TResponseBodySchema = unknown,
  TRequestHeadersSchema = unknown,
  TResponseHeadersSchema = unknown
> {
  /** Schemas applied to the outgoing request */
  request?: {
    /** Schema to validate request body against */
    body?: TRequestBodySchema;
    /** Schema to validate request headers against */
    headers?: TRequestHeadersSchema;
  };
  /** Schemas applied to the incoming response */
  response?: {
    /** Schema to validate response body against */
    body?: TResponseBodySchema;
    /** Schema to validate response headers against */
    headers?: TResponseHeadersSchema;
  };
}

/**
 * Extended fetch options with optional validation schemas.
 * Maintains compatibility with native RequestInit while adding validation
 * via the `validate` block.
 */
export interface PraptiOptions<
  TRequestBodySchema = unknown,
  TResponseBodySchema = unknown,
  TRequestHeadersSchema = unknown,
  TResponseHeadersSchema = unknown
> extends Omit<RequestInit, "body" | "headers"> {
  /** Request body — accepts native BodyInit types or a plain object/array (auto-JSON-stringified) */
  body?: BodyInit | null | Record<string, unknown> | unknown[];
  /** Request headers - can be HeadersInit or plain object */
  headers?: HeadersInit | Record<string, unknown>;
  /** All schema validation options, grouped by direction */
  validate?: ValidateOptions<
    TRequestBodySchema,
    TResponseBodySchema,
    TRequestHeadersSchema,
    TResponseHeadersSchema
  >;
}
