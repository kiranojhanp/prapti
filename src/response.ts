import type { ValidationAdapter, InferOutput } from "./types";

/**
 * Enhanced Response class with validation-aware methods
 * Extends native Response to provide type-safe data parsing
 */
export class ValidatedResponse<T = unknown, THeadersSchema = any> extends Response {
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
      this.validatedHeadersCache = this.adapter.parse(this.responseHeadersSchema, headersObj);
      return this.validatedHeadersCache as R;
    }

    const headersObj: Record<string, string> = {};
    this.headers.forEach((value, key) => {
      headersObj[key.toLowerCase()] = value;
    });

    return headersObj as unknown as R;
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
