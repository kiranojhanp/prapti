import type { ValidationAdapter } from "./types";

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
export const adapters = {
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
