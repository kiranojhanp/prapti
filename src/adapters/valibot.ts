import type { ValidationAdapter } from "../types";

// Standard Schema spec (https://github.com/standard-schema/standard-schema)
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
 * Adapter for Valibot (https://valibot.dev).
 * Import directly for tree-shaking: import { valibotAdapter } from "prapti/adapters/valibot"
 *
 * Note: async schemas are not supported. Use synchronous schemas
 * (v.string(), v.object(), etc.) without async actions.
 */
export const valibotAdapter: ValidationAdapter<ValibotSchema> = {
  parse: <O>(schema: ValibotSchema<O>, data: unknown): O => {
    const result = schema["~standard"].validate(data);
    if (result instanceof Promise) {
      throw new Error(
        "Valibot async schemas are not supported. Use synchronous schemas (v.string(), v.object(), etc.) without async actions."
      );
    }
    if ("issues" in result) {
      const msg = Array.from(result.issues as ArrayLike<{ message?: string }>)
        .map((i) => i?.message ?? "Unknown issue")
        .join("; ");
      throw new Error(`Valibot validation failed: ${msg}`);
    }
    return result.value;
  },
};
