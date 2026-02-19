import type { ValidationAdapter } from "../types";

type YupSchema<O = unknown> = {
  validateSync: (data: unknown, options?: object) => O;
  __outputType: O;
};

/**
 * Adapter for Yup (https://github.com/jquense/yup).
 * Import directly for tree-shaking: import { yupAdapter } from "prapti/adapters/yup"
 */
export const yupAdapter: ValidationAdapter<YupSchema> = {
  parse: <O>(schema: YupSchema<O>, data: unknown): O =>
    schema.validateSync(data, { abortEarly: false }),
};
