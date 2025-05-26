/**
 * Prapti - Type-safe HTTP client with schema validation
 * "प्राप्ति" (Prapti) - Sanskrit for "fetch" or "obtain"
 */

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
interface PraptiOptions<TRequestSchema = unknown, TResponseSchema = unknown>
  extends Omit<RequestInit, "body"> {
  /** Request body - can be any serializable data when using requestSchema */
  body?: BodyInit | null | unknown;
  /** Schema to validate request body against */
  requestSchema?: TRequestSchema;
  /** Schema to validate response data against */
  responseSchema?: TResponseSchema;
}

/**
 * Enhanced Response class with validation-aware methods
 * Extends native Response to provide type-safe data parsing
 */
class ValidatedResponse<T = unknown> extends Response {
  constructor(
    response: Response,
    private adapter: ValidationAdapter<any>,
    private responseSchema?: any
  ) {
    super(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    // Preserve prototype chain for proper instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

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
    const data = await super.formData();

    if (this.responseSchema) {
      // Convert FormData to plain object for validation
      const obj = Object.fromEntries(data.entries());
      this.adapter.parse(this.responseSchema, obj);
    }

    return data;
  }
}

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
   * Make an HTTP request with optional request/response validation
   * @param input - Request URL or Request object
   * @param options - Extended fetch options with validation schemas
   * @returns Promise resolving to ValidatedResponse with inferred types
   */
  async fetch<TResponseSchema extends TSchema = never>(
    input: RequestInfo | URL,
    options?: PraptiOptions<TSchema, TResponseSchema>
  ): Promise<
    ValidatedResponse<
      TResponseSchema extends never ? unknown : InferOutput<TResponseSchema>
    >
  > {
    const { requestSchema, responseSchema, body, ...fetchOptions } =
      options || {};

    let finalBody: BodyInit | null | undefined;
    const headers = new Headers(fetchOptions.headers);

    // Validate and process request body if schema provided
    if (requestSchema && body !== undefined && body !== null) {
      // Parse string body if needed, otherwise use as-is
      const parsedBody = typeof body === "string" ? JSON.parse(body) : body;

      // Validate request data against schema
      const validatedBody = this.adapter.parse(requestSchema, parsedBody);

      // Serialize for transmission
      finalBody = JSON.stringify(validatedBody);

      // Set content type if not already specified
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
    } else {
      // Use body as-is when no validation needed
      finalBody = body as BodyInit | null | undefined;
    }

    // Make the actual fetch request
    const response = await fetch(input, {
      ...fetchOptions,
      headers,
      body: finalBody,
    });

    // Return enhanced response with validation capabilities
    return new ValidatedResponse<
      TResponseSchema extends never ? unknown : InferOutput<TResponseSchema>
    >(response, this.adapter, responseSchema);
  }
}

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
 * Pre-built adapters for some popular validation libraries
 * TODO: add more
 */
const adapters = {
  /**
   * Zod adapter factory
   * @param zod - Zod library import
   * @returns ValidationAdapter for Zod schemas
   */
  zod: {
    parse: <T>(schema: any, data: unknown): T => schema.parse(data),
  } as ValidationAdapter,
};

// Export core types and classes
export { adapters, Prapti, createPrapti, ValidatedResponse };
export type { InferOutput, PraptiOptions, ValidationAdapter };
