/**
 * Re-exports all adapters for convenience.
 * For tree-shaking, import directly from the subpath:
 *   import { zodAdapter } from "prapti/adapters/zod"
 */
export { zodAdapter } from "./adapters/zod";
export { yupAdapter } from "./adapters/yup";
export { valibotAdapter } from "./adapters/valibot";

/**
 * @deprecated Use named adapter imports instead:
 *   import { zodAdapter } from "prapti/adapters/zod"
 *   import { yupAdapter } from "prapti/adapters/yup"
 *   import { valibotAdapter } from "prapti/adapters/valibot"
 */
import { zodAdapter } from "./adapters/zod";
import { yupAdapter } from "./adapters/yup";
import { valibotAdapter } from "./adapters/valibot";

export const adapters = {
  zod: zodAdapter,
  yup: yupAdapter,
  valibot: valibotAdapter,
};
