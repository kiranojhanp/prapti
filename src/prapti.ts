import type {
  HeaderValidationMode,
  InferOutput,
  PraptiConfig,
  PraptiOptions,
  SerializationAdapter,
  ValidationAdapter,
} from "./types";
import { ValidatedResponse } from "./response";
import {
  formDataToObject,
  objectToFormData,
  objectToUrlSearchParams,
  urlSearchParamsToObject,
} from "./body-helpers";

const defaultSerializer: SerializationAdapter = {
  stringify: (value: unknown) => JSON.stringify(value),
  parse: (value: string) => JSON.parse(value),
  isJsonContentType: (contentType: string | null) => {
    if (!contentType) return false;
    const normalized = contentType.toLowerCase();
    const mediaType = normalized.split(";")[0] ?? "";
    const trimmedMediaType = mediaType.trim();
    return (
      trimmedMediaType === "application/json" ||
      (trimmedMediaType.startsWith("application/") &&
        trimmedMediaType.endsWith("+json"))
    );
  },
};

/**
 * Type-safe HTTP client with validation capabilities
 * Wraps native fetch API with schema validation support
 */
export class Prapti<TSchema = unknown> {
  private serializer: SerializationAdapter;
  private headerValidationMode: HeaderValidationMode;

  /**
   * Create a new Prapti instance
   * @param adapter - Validation adapter for chosen schema library
   * @param config - Optional serializer and header validation config
   */
  constructor(
    private adapter: ValidationAdapter<TSchema>,
    config: PraptiConfig = {}
  ) {
    this.serializer = config.serializer ?? defaultSerializer;
    this.headerValidationMode = config.headerValidationMode ?? "preserve";
  }

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
        if (value === undefined || value === null) return;
        obj[key.toLowerCase()] = String(value);
      });
      return obj;
    }

    // Plain object - normalize keys to lowercase
    const obj: Record<string, string> = {};
    Object.entries(headers).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      obj[key.toLowerCase()] = String(value);
    });
    return obj;
  }

  private isJsonContentType(contentType: string | null): boolean {
    return this.serializer.isJsonContentType
      ? this.serializer.isJsonContentType(contentType)
      : defaultSerializer.isJsonContentType?.(contentType) ?? false;
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
    const rawHeaders = this.headersToObject(headers);

    // Validate request headers if schema provided
    if (requestHeadersSchema) {
      if (this.headerValidationMode === "preserve") {
        // Preserve original headers by default
        Object.entries(rawHeaders).forEach(([key, value]) => {
          finalHeaders.set(key, value);
        });
      }

      const validatedHeaders = this.adapter.parse(
        requestHeadersSchema,
        rawHeaders
      );

      if (validatedHeaders && typeof validatedHeaders === "object") {
        Object.entries(validatedHeaders as Record<string, unknown>).forEach(
          ([key, value]) => {
            if (value === undefined || value === null) {
              finalHeaders.delete(key);
              return;
            }
            finalHeaders.set(key, String(value));
          }
        );
      }
    } else {
      // Use headers as-is if no schema
      Object.entries(rawHeaders).forEach(([key, value]) => {
        finalHeaders.set(key, value);
      });
    }

    // Process and validate request body
    if (body !== undefined && body !== null) {
      if (requestBodySchema) {
        let parsedBody: unknown;
        const validatedContentType = finalHeaders.get("content-type");
        const contentType = validatedContentType;

        // Handle different body types for validation
        if (typeof body === "string") {
          const isJson = this.isJsonContentType(contentType);
          if (isJson) {
            try {
              parsedBody = this.serializer.parse(body);
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              throw new Error(`Invalid JSON request body: ${errorMessage}`);
            }
          } else if (contentType === null) {
            try {
              parsedBody = this.serializer.parse(body);
            } catch {
              parsedBody = body;
            }
          } else {
            parsedBody = body;
          }
        } else if (body instanceof FormData) {
          parsedBody = formDataToObject(body);
        } else if (body instanceof URLSearchParams) {
          parsedBody = urlSearchParamsToObject(body);
        } else {
          parsedBody = body;
        }

        // Validate request data against schema
        const validatedData = this.adapter.parse(requestBodySchema, parsedBody);

        // Process the validated data based on original body type
        if (body instanceof FormData) {
          finalBody = objectToFormData(
            validatedData as Record<string, unknown>
          );
        } else if (body instanceof URLSearchParams) {
          finalBody = objectToUrlSearchParams(
            validatedData as Record<string, unknown>
          );
        } else {
          let usedJsonSerializer = false;
          if (typeof validatedData === "string") {
            const isJson = this.isJsonContentType(contentType);
            if (isJson) {
              finalBody = this.serializer.stringify(validatedData);
              usedJsonSerializer = true;
            } else {
              finalBody = validatedData;
            }
          } else {
            finalBody = this.serializer.stringify(validatedData);
            usedJsonSerializer = true;
          }

          // Set content type if not already specified
          const canAutoSetContentType = !requestHeadersSchema;
          if (
            usedJsonSerializer &&
            canAutoSetContentType &&
            !finalHeaders.has("Content-Type")
          ) {
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
          finalBody = this.serializer.stringify(body);
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
      TResponseHeadersSchema,
      TSchema
    >(
      response,
      this.adapter,
      responseBodySchema,
      responseHeadersSchema,
      this.serializer
    );
  }
}

/**
 * Convenience function to create a Prapti instance
 * @param adapter - Validation adapter
 * @returns New Prapti instance
 */
export function prapti<TSchema>(
  adapter: ValidationAdapter<TSchema>,
  config?: PraptiConfig
): Prapti<TSchema> {
  return new Prapti(adapter, config);
}
