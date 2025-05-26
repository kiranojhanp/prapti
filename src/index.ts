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
   * Parse and validate data against the provided schema
   * @param schema - The validation schema
   * @param data - Data to validate
   * @returns Validated and typed data
   * @throws Validation error if data doesn't match schema
   */
  parse<T>(schema: TSchema, data: unknown): T;
}

/**
 * Type helper to infer output type from various schema formats
 * Supports multiple validation library conventions
 */
type InferOutput<T> = T extends { _output: infer U }
  ? U // Zod schema format
  : T extends { _type: infer U }
  ? U // Valibot schema format
  : T extends (...args: any[]) => infer U
  ? U // Function-based schemas
  : unknown; // Fallback for unsupported formats

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
  /** Request body - can be any serializable data when using requestSchema */
  body?: BodyInit | null | unknown;
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
    this.adapter.parse(this.responseHeadersSchema, headersObj);
  }

  /**
   * Get validated headers as typed object
   * @returns Validated headers object if schema provided, otherwise plain object
   */
  getValidatedHeaders<
    T = THeadersSchema extends { _output: infer U }
      ? U
      : THeadersSchema extends { _type: infer U }
      ? U
      : Record<string, string>
  >(): T {
    const headersObj: Record<string, string> = {};
    this.headers.forEach((value, key) => {
      headersObj[key.toLowerCase()] = value;
    });

    return this.responseHeadersSchema
      ? this.adapter.parse<T>(this.responseHeadersSchema, headersObj)
      : (headersObj as unknown as T);
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
    return this.responseSchema
      ? this.adapter.parse<T>(this.responseSchema, data)
      : (data as T);
  }

  /**
   * Parse text response and validate with schema if provided
   * @returns Promise resolving to validated text data
   */
  async text(): Promise<string> {
    const data = await super.text();
    return this.responseSchema
      ? this.adapter.parse<string>(this.responseSchema, data)
      : data;
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

    // Process and validate request headers
    if (headers) {
      const headersObj = this.headersToObject(headers);

      // Validate request headers if schema provided
      if (requestHeadersSchema) {
        const validatedHeaders = this.adapter.parse(
          requestHeadersSchema,
          headersObj
        );
        if (validatedHeaders && typeof validatedHeaders === "object") {
          Object.entries(validatedHeaders as Record<string, unknown>).forEach(
            ([key, value]) => {
              finalHeaders.set(key, String(value));
            }
          );
        }
      } else {
        // Use headers as-is
        Object.entries(headersObj).forEach(([key, value]) => {
          finalHeaders.set(key, value);
        });
      }
    }

    // Validate and process request body if schema provided
    if (requestSchema && body !== undefined && body !== null) {
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
      // Use body as-is when no validation needed
      finalBody = body as BodyInit | null | undefined;
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

/**
 * Pre-built adapters for popular validation libraries
 */
const adapters = {
  /**
   * Zod adapter
   * @returns ValidationAdapter for Zod schemas
   */
  zod: {
    parse: <T>(schema: any, data: unknown): T => schema.parse(data),
  } as ValidationAdapter,

  // TODO: Add more adapters for other validation libraries
};

// =========================================================
// EXPORTS
// =========================================================

// Export core classes and functions
export { adapters, Prapti, createPrapti, ValidatedResponse };

// Export types and interfaces
export type { InferOutput, PraptiOptions, ValidationAdapter };
