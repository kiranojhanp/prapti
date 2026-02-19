import type { ValidationAdapter, InferOutput, PraptiOptions } from "./types";
import { ValidatedResponse } from "./response";

/**
 * Type-safe HTTP client with validation capabilities
 * Wraps native fetch API with schema validation support
 */
export class Prapti<TSchema = unknown> {
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
      validate,
      body,
      headers,
      ...fetchOptions
    } = options || {};

    const requestBodySchema = validate?.request?.body;
    const requestHeadersSchema = validate?.request?.headers;
    const responseBodySchema = validate?.response?.body;
    const responseHeadersSchema = validate?.response?.headers as TResponseHeadersSchema | undefined;

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
      if (requestBodySchema) {
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
        const validatedData = this.adapter.parse(requestBodySchema, parsedBody);

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
    >(response, this.adapter, responseBodySchema, responseHeadersSchema);
  }
}

/**
 * Convenience function to create a Prapti instance
 * @param adapter - Validation adapter
 * @returns New Prapti instance
 */
export function prapti<TSchema>(
  adapter: ValidationAdapter<TSchema>
): Prapti<TSchema> {
  return new Prapti(adapter);
}
