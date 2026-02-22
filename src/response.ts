import type { ValidationAdapter, InferOutput, SerializationAdapter } from "./types";
import {
  formDataToObject,
  objectToFormData,
  objectToUrlSearchParams,
  urlSearchParamsToObject,
} from "./body-helpers";

const defaultSerializer: SerializationAdapter = {
  stringify: (value: unknown) => JSON.stringify(value),
  parse: (value: string) => JSON.parse(value),
};

/**
 * Enhanced Response class with validation-aware methods
 * Extends native Response to provide type-safe data parsing
 */
export class ValidatedResponse<
  T = unknown,
  THeadersSchema = unknown,
  TSchema = unknown
> extends Response {
  private validatedHeadersCache:
    | InferOutput<THeadersSchema>
    | Record<string, string>
    | undefined = undefined;

  constructor(
    response: Response,
    private adapter: ValidationAdapter<TSchema>,
    private responseSchema?: TSchema,
    private responseHeadersSchema?: THeadersSchema & TSchema,
    private serializer: SerializationAdapter = defaultSerializer
  ) {
    const baseResponse = response.bodyUsed ? response : response.clone();
    super(baseResponse.body, baseResponse);
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
    const headersObj = this.rawHeaders();

    // Validate headers - this will throw if validation fails
    // Store result in cache
    this.validatedHeadersCache = this.adapter.parse(
      this.responseHeadersSchema,
      headersObj
    ) as InferOutput<THeadersSchema>;
  }

  /**
   * Get validated headers as a typed object.
   * Returns the schema-validated result if a response headers schema was provided,
   * otherwise returns a plain lowercase-keyed object of all response headers.
   */
  get validatedHeaders(): THeadersSchema extends infer S ? InferOutput<S> : Record<string, string> {
    type R = THeadersSchema extends infer S ? InferOutput<S> : Record<string, string>;

    if (this.responseHeadersSchema) {
      // Return cached result if available (populated eagerly in constructor)
      if (this.validatedHeadersCache !== undefined) {
        return this.validatedHeadersCache as R;
      }

      // Fallback: re-validate if cache is somehow empty
      const headersObj: Record<string, string> = {};
      this.headers.forEach((value, key) => {
        headersObj[key.toLowerCase()] = value;
      });
      this.validatedHeadersCache = this.adapter.parse(
        this.responseHeadersSchema,
        headersObj
      ) as InferOutput<THeadersSchema>;
      return this.validatedHeadersCache as R;
    }

    return this.rawHeaders() as unknown as R;
  }

  /**
   * Get raw response headers as a lowercase-keyed object.
   */
  rawHeaders(): Record<string, string> {
    const headersObj: Record<string, string> = {};
    this.headers.forEach((value, key) => {
      headersObj[key.toLowerCase()] = value;
    });
    return headersObj;
  }

  // -------------------------
  // Response parsing methods
  // -------------------------

  /**
   * Parse JSON response and validate with schema if provided
   * @returns Promise resolving to validated JSON data
   */
  async json(): Promise<T> {
    const text = await super.text();
    const data = this.serializer.parse(text);
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
      const obj = formDataToObject(formData);

      // Validate the object against schema
      const validatedData = this.adapter.parse(this.responseSchema, obj);

      // If validation changes data, create new FormData with validated values
      if (validatedData && typeof validatedData === "object") {
        return objectToFormData(
          validatedData as Record<string, unknown>,
          this.serializer.formDataValueMode ?? "native"
        );
      } else {
        // If schema returns non-object (e.g. primitive), we can't represent it as FormData.
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
      const obj = urlSearchParamsToObject(params);

      // Validate the object against schema
      const validatedData = this.adapter.parse(this.responseSchema, obj);

      // If validation changes data, create new URLSearchParams with validated values
      if (validatedData && typeof validatedData === "object") {
        return objectToUrlSearchParams(validatedData as Record<string, unknown>);
      } else {
        // Same as formData, must return object to be representable as URLSearchParams.
        throw new Error(
          "Schema validation result is not an object, cannot be converted to URLSearchParams"
        );
      }
    }

    return params;
  }
}
