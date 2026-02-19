/**
 * Prapti - Type-safe HTTP client with schema validation
 * "प्राप्ति" (Prapti) - Sanskrit for "fetch" or "obtain"
 */

// =========================================================
// TYPES AND INTERFACES
// =========================================================

/**
 * Validation adapter interface for different schema libraries
 * Supports Zod, Valibot, Yup, Joi, and other validation libraries
 */
interface ValidationAdapter<TSchema = unknown> {
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
type InferOutput<T> =
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
interface PraptiOptions<
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

// =========================================================
// VALIDATED RESPONSE CLASS
// =========================================================

/**
 * Enhanced Response class with validation-aware methods
 * Extends native Response to provide type-safe data parsing
 */
class ValidatedResponse<T = unknown, THeadersSchema = any> extends Response {
  private validatedHeadersCache: any = undefined;

  constructor(
    response: Response,
    private adapter: ValidationAdapter<any>,
    private responseSchema?: any,
    private responseHeadersSchema?: THeadersSchema
  ) {
    super(response.body, response);
    Object.setPrototypeOf(this, ValidatedResponse.prototype);

    // Validate response headers if schema provided
    if (responseHeadersSchema) {
      this.validateResponseHeaders();
    }
  }

  /**
   * Validate response headers against schema
   * @private
   */
  private validateResponseHeaders(): void {
    if (!this.responseHeadersSchema) return;

    // Convert Headers to plain object for validation
    const headersObj: Record<string, string> = {};
    this.headers.forEach((value, key) => {
      headersObj[key.toLowerCase()] = value;
    });

    // Validate headers - this will throw if validation fails
    // Store result in cache
    this.validatedHeadersCache = this.adapter.parse(this.responseHeadersSchema, headersObj);
  }

  /**
   * Get validated headers as typed object
   * @returns Validated headers object if schema provided, otherwise plain object
   */
  getValidatedHeaders<
    T = THeadersSchema extends infer S ? InferOutput<S> : Record<string, string>
  >(): T {
    if (this.responseHeadersSchema) {
      // Return cached result if available (should be populated in constructor)
      if (this.validatedHeadersCache !== undefined) {
        return this.validatedHeadersCache as T;
      }

      // Fallback: re-validate if somehow cache is empty but schema exists
      const headersObj: Record<string, string> = {};
      this.headers.forEach((value, key) => {
        headersObj[key.toLowerCase()] = value;
      });
      this.validatedHeadersCache = this.adapter.parse(this.responseHeadersSchema, headersObj);
      return this.validatedHeadersCache as T;
    }

    const headersObj: Record<string, string> = {};
    this.headers.forEach((value, key) => {
      headersObj[key.toLowerCase()] = value;
    });

    return headersObj as unknown as T;
  }

  // -------------------------
  // Response parsing methods
  // -------------------------

  /**
   * Parse JSON response and validate with schema if provided
   * @returns Promise resolving to validated JSON data
   */
  async json(): Promise<T> {
    const data = await super.json();
    return (
      this.responseSchema
        ? this.adapter.parse(this.responseSchema, data)
        : data
    ) as T;
  }

  /**
   * Get raw text response - no schema validation applied.
   * Text is a raw byte representation; use json() for structured validation.
   * @returns Promise resolving to the raw response text
   */
  async text(): Promise<string> {
    return super.text();
  }

  /**
   * Get blob response - no validation as it's binary data
   * @returns Promise resolving to Blob
   */
  async blob(): Promise<Blob> {
    return super.blob();
  }

  /**
   * Get array buffer response - no validation as it's binary data
   * @returns Promise resolving to ArrayBuffer
   */
  async arrayBuffer(): Promise<ArrayBuffer> {
    return super.arrayBuffer();
  }

  /**
   * Parse form data response and validate with schema if provided
   * Note: Validation converts FormData to plain object for schema checking
   * @returns Promise resolving to FormData
   */
  async formData(): Promise<FormData> {
    const formData = await super.formData();

    if (this.responseSchema) {
      // Convert FormData to plain object for validation
      const obj: Record<string, unknown> = {};
      formData.forEach((value, key) => {
        if (obj[key] !== undefined) {
          if (Array.isArray(obj[key])) {
            (obj[key] as unknown[]).push(value);
          } else {
            obj[key] = [obj[key], value];
          }
        } else {
          obj[key] = value;
        }
      });

      // Validate the object against schema
      const validatedData = this.adapter.parse(this.responseSchema, obj);

      // If validation changes data, create new FormData with validated values
      if (validatedData && typeof validatedData === "object") {
        const validatedFormData = new FormData();
        Object.entries(validatedData as Record<string, unknown>).forEach(
          ([key, value]) => {
            if (Array.isArray(value)) {
              value.forEach((item) =>
                validatedFormData.append(key, item as string | Blob)
              );
            } else {
              validatedFormData.append(key, value as string | Blob);
            }
          }
        );
        return validatedFormData;
      } else {
        // Fix: If schema returns non-object (e.g. primitive), we can't represent it as FormData.
        // It's likely a schema mismatch or transformation to non-FormData structure.
        // Throwing error is safer than returning unvalidated original data.
        throw new Error(
          "Schema validation result is not an object, cannot be converted to FormData"
        );
      }
    }

    return formData;
  }

  /**
   * Parse URLSearchParams response and validate with schema if provided
   * @returns Promise resolving to URLSearchParams
   */
  async urlSearchParams(): Promise<URLSearchParams> {
    const text = await super.text();
    const params = new URLSearchParams(text);

    if (this.responseSchema) {
      // Convert URLSearchParams to plain object for validation
      const obj: Record<string, unknown> = {};
      params.forEach((value, key) => {
        if (obj[key] !== undefined) {
          if (Array.isArray(obj[key])) {
            (obj[key] as unknown[]).push(value);
          } else {
            obj[key] = [obj[key], value];
          }
        } else {
          obj[key] = value;
        }
      });

      // Validate the object against schema
      const validatedData = this.adapter.parse(this.responseSchema, obj);

      // If validation changes data, create new URLSearchParams with validated values
      if (validatedData && typeof validatedData === "object") {
        const validatedParams = new URLSearchParams();
        Object.entries(validatedData as Record<string, unknown>).forEach(
          ([key, value]) => {
            if (Array.isArray(value)) {
              value.forEach((item) =>
                validatedParams.append(key, String(item))
              );
            } else {
              validatedParams.append(key, String(value));
            }
          }
        );
        return validatedParams;
      } else {
        // Fix: Same as formData, must return object to be representable
        throw new Error(
          "Schema validation result is not an object, cannot be converted to URLSearchParams"
        );
      }
    }

    return params;
  }
}

// =========================================================
// MAIN CLIENT IMPLEMENTATION
// =========================================================

/**
 * Type-safe HTTP client with validation capabilities
 * Wraps native fetch API with schema validation support
 */
class Prapti<TSchema = unknown> {
  /**
   * Create a new Prapti instance
   * @param adapter - Validation adapter for chosen schema library
   */
  constructor(private adapter: ValidationAdapter<TSchema>) {}

  /**
   * Convert Headers object or HeadersInit to plain object
   * @private
   */
  private headersToObject(
    headers: HeadersInit | Record<string, unknown> | undefined
  ): Record<string, string> {
    if (!headers) return {};

    if (headers instanceof Headers) {
      const obj: Record<string, string> = {};
      headers.forEach((value, key) => {
        obj[key.toLowerCase()] = value;
      });
      return obj;
    }

    if (Array.isArray(headers)) {
      const obj: Record<string, string> = {};
      headers.forEach(([key, value]) => {
        obj[key.toLowerCase()] = String(value);
      });
      return obj;
    }

    // Plain object - normalize keys to lowercase
    const obj: Record<string, string> = {};
    Object.entries(headers).forEach(([key, value]) => {
      obj[key.toLowerCase()] = String(value);
    });
    return obj;
  }

  /**
   * Convert FormData object to plain object for validation
   * @private
   */
  private formDataToObject(formData: FormData): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      // Handle multiple values for the same key
      if (result[key] !== undefined) {
        if (Array.isArray(result[key])) {
          (result[key] as unknown[]).push(value);
        } else {
          result[key] = [result[key], value];
        }
      } else {
        result[key] = value;
      }
    });
    return result;
  }

  /**
   * Convert URLSearchParams to plain object for validation
   * @private
   */
  private urlSearchParamsToObject(
    params: URLSearchParams
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    params.forEach((value, key) => {
      // Handle multiple values for the same key
      if (result[key] !== undefined) {
        if (Array.isArray(result[key])) {
          (result[key] as unknown[]).push(value);
        } else {
          result[key] = [result[key], value];
        }
      } else {
        result[key] = value;
      }
    });
    return result;
  }

  /**
   * Make an HTTP request with optional request/response validation
   * @param input - Request URL or Request object
   * @param options - Extended fetch options with validation schemas
   * @returns Promise resolving to ValidatedResponse with inferred types
   */
  async fetch<
    TResponseSchema extends TSchema = never,
    TResponseHeadersSchema extends TSchema = never
  >(
    input: RequestInfo | URL,
    options?: PraptiOptions<
      TSchema,
      TResponseSchema,
      TSchema,
      TResponseHeadersSchema
    >
  ): Promise<
    ValidatedResponse<
      TResponseSchema extends never ? unknown : InferOutput<TResponseSchema>,
      TResponseHeadersSchema
    >
  > {
    const {
      requestSchema,
      responseSchema,
      requestHeadersSchema,
      responseHeadersSchema,
      body,
      headers,
      ...fetchOptions
    } = options || {};

    let finalBody: BodyInit | null | undefined;
    let finalHeaders = new Headers();

    // Process headers if provided
    if (headers) {
      const headersObj = this.headersToObject(headers);

      // Validate request headers if schema provided
      if (requestHeadersSchema) {
        const validatedHeaders = this.adapter.parse(
          requestHeadersSchema,
          headersObj
        );
        
        // Add all original headers first
        Object.entries(headersObj).forEach(([key, value]) => {
          finalHeaders.set(key, value);
        });

        // Override with validated headers
        if (validatedHeaders && typeof validatedHeaders === "object") {
          Object.entries(validatedHeaders as Record<string, unknown>).forEach(
            ([key, value]) => {
              finalHeaders.set(key, String(value));
            }
          );
        }
      } else {
        // Use headers as-is if no schema
        Object.entries(headersObj).forEach(([key, value]) => {
          finalHeaders.set(key, value);
        });
      }
    }

    // Process and validate request body
    if (body !== undefined && body !== null) {
      if (requestSchema) {
        let parsedBody: unknown;

        // Handle different body types for validation
        if (typeof body === "string") {
          try {
            parsedBody = JSON.parse(body);
          } catch {
            parsedBody = body;
          }
        } else if (body instanceof FormData) {
          parsedBody = this.formDataToObject(body);
        } else if (body instanceof URLSearchParams) {
          parsedBody = this.urlSearchParamsToObject(body);
        } else {
          parsedBody = body;
        }

        // Validate request data against schema
        const validatedData = this.adapter.parse(requestSchema, parsedBody);

        // Process the validated data based on original body type
        if (body instanceof FormData) {
          // Create new FormData with validated data
          const validatedFormData = new FormData();
          Object.entries(validatedData as Record<string, unknown>).forEach(
            ([key, value]) => {
              if (Array.isArray(value)) {
                value.forEach((item) =>
                  validatedFormData.append(key, item as string | Blob)
                );
              } else {
                validatedFormData.append(key, value as string | Blob);
              }
            }
          );
          finalBody = validatedFormData;
        } else if (body instanceof URLSearchParams) {
          // Create new URLSearchParams with validated data
          const validatedParams = new URLSearchParams();
          Object.entries(validatedData as Record<string, unknown>).forEach(
            ([key, value]) => {
              if (Array.isArray(value)) {
                value.forEach((item) =>
                  validatedParams.append(key, String(item))
                );
              } else {
                validatedParams.append(key, String(value));
              }
            }
          );
          finalBody = validatedParams;
        } else {
          // For JSON and other formats
          finalBody = JSON.stringify(validatedData);

          // Set content type if not already specified
          if (!finalHeaders.has("Content-Type")) {
            finalHeaders.set("Content-Type", "application/json");
          }
        }
      } else {
        // No request schema - use body as-is but handle plain objects
        if (
          typeof body === "object" &&
          body !== null &&
          !(body instanceof FormData) &&
          !(body instanceof URLSearchParams) &&
          !(body instanceof Blob) &&
          !(body instanceof ArrayBuffer) &&
          !ArrayBuffer.isView(body) &&
          !(body instanceof ReadableStream)
        ) {
          // It's a plain object, stringify it
          finalBody = JSON.stringify(body);
          if (!finalHeaders.has("Content-Type")) {
            finalHeaders.set("Content-Type", "application/json");
          }
        } else {
          finalBody = body as BodyInit;
        }
      }
    }

    // Make the actual fetch request
    const response = await fetch(input, {
      ...fetchOptions,
      headers: finalHeaders,
      body: finalBody,
    });

    // Return enhanced response with validation capabilities
    return new ValidatedResponse<
      TResponseSchema extends never ? unknown : InferOutput<TResponseSchema>,
      TResponseHeadersSchema
    >(response, this.adapter, responseSchema, responseHeadersSchema);
  }
}

// =========================================================
// FACTORY FUNCTION AND PRE-BUILT ADAPTERS
// =========================================================

/**
 * Convenience function to create Prapti instance
 * @param adapter - Validation adapter
 * @returns New Prapti instance
 */
function createPrapti<TSchema>(
  adapter: ValidationAdapter<TSchema>
): Prapti<TSchema> {
  return new Prapti(adapter);
}

// ---- Zod types (peer dependency, import type only) ----
type ZodSchema<O = unknown> = { parse: (data: unknown) => O; _output: O };

// ---- Yup types (peer dependency, import type only) ----
type YupSchema<O = unknown> = {
  validateSync: (data: unknown, options?: object) => O;
  __outputType: O;
};

// ---- Valibot types (peer dependency, import type only) ----
// Standard Schema spec (https://github.com/standard-schema/standard-schema)
// validate() may return sync or async result — both must be supported.
type ValibotResult<O> = { value: O } | { issues: ArrayLike<unknown> };
type ValibotSchema<O = unknown> = {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: "valibot";
    readonly validate: (value: unknown) => ValibotResult<O> | Promise<ValibotResult<O>>;
    readonly types?: { readonly input?: unknown; readonly output?: O };
  };
};

/**
 * Pre-built adapters for popular validation libraries.
 * Each adapter is fully type-safe: the schema parameter carries the output
 * type so callers get correct inference without any `any` escapes.
 */
const adapters = {
  /**
   * Adapter for Zod (https://zod.dev).
   * Usage: createPrapti(adapters.zod)
   */
  zod: {
    parse: <O>(schema: ZodSchema<O>, data: unknown): O => schema.parse(data),
  } satisfies ValidationAdapter<ZodSchema>,

  /**
   * Adapter for Yup (https://github.com/jquense/yup).
   * Usage: createPrapti(adapters.yup)
   */
  yup: {
    parse: <O>(schema: YupSchema<O>, data: unknown): O =>
      schema.validateSync(data, { abortEarly: false }),
  } satisfies ValidationAdapter<YupSchema>,

  /**
   * Adapter for Valibot (https://valibot.dev).
   * Valibot's API is functional: v.parse(schema, data) — not schema.parse(data).
   * This adapter bridges that correctly.
   * Usage: createPrapti(adapters.valibot)
   */
  valibot: {
    parse: <O>(schema: ValibotSchema<O>, data: unknown): O => {
      // Valibot's Standard Schema interface: call ~standard.validate
      const result = schema["~standard"].validate(data);
      // validate() can return Promise for async schemas — prapti does not support async validation
      if (result instanceof Promise) {
        throw new Error(
          "Valibot async schemas are not supported. Use synchronous schemas (v.string(), v.object(), etc.) without async actions."
        );
      }
      // Sync result: { value } on success or { issues } on failure
      if ("issues" in result) {
        const msg = Array.from(result.issues as ArrayLike<{ message?: string }>)
          .map((i) => i?.message ?? "Unknown issue")
          .join("; ");
        throw new Error(`Valibot validation failed: ${msg}`);
      }
      return result.value;
    },
  } satisfies ValidationAdapter<ValibotSchema>,
};

// =========================================================
// EXPORTS
// =========================================================

// Export core classes and functions
export { adapters, Prapti, createPrapti, ValidatedResponse };

// Export types and interfaces
export type { InferOutput, PraptiOptions, ValidationAdapter };
