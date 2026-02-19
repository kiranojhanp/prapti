# Prapti Restructuring Plan

**Date:** 2026-02-19  
**Goal:** Split the monolithic `src/index.ts` into focused modules, remove dead code, and consolidate test files.

---

## Final Structure

### Source

```
src/
├── types.ts          # All exported TypeScript types and interfaces
├── adapters.ts       # adapters.zod, adapters.yup, adapters.valibot (+ internal schema types)
├── response.ts       # ValidatedResponse class
├── prapti.ts         # Prapti class + createPrapti factory
└── index.ts          # Re-exports only (public API barrel)
```

### Tests

```
test/
├── adapters.test.ts           # (moved from test/fixes/adapters.test.ts)
├── prapti.test.ts             # (moved from test/fixes/prapti-class.test.ts)
├── validated-response.test.ts # (moved from test/fixes/validated-response.test.ts)
├── form-data.test.ts          # (unchanged)
├── headers.test.ts            # (unchanged)
└── integration.test.ts        # (renamed from test/index.test.ts)
```

Remove: `src/adapters/valibot.ts` (dead code — incorrect API usage, superseded by `adapters.ts`)  
Remove: `test/fixes/` directory (all tests promoted to top-level)

---

## Tasks

### Task 1 — Create `src/types.ts`

Extract all types from `src/index.ts`:

- `ValidationAdapter<TSchema>`
- `InferOutput<T>`
- `PraptiOptions<TReqSchema, TResSchema, TReqHeadersSchema, TResHeadersSchema>`

No imports from other src files needed. These are pure type declarations.

### Task 2 — Create `src/adapters.ts`

Extract adapter-related code from `src/index.ts`:

- Internal types: `ZodSchema<O>`, `YupSchema<O>`, `ValibotResult<O>`, `ValibotSchema<O>`
- Import `ValidationAdapter` from `./types`
- Export `adapters` object with `.zod`, `.yup`, `.valibot`

### Task 3 — Create `src/response.ts`

Extract `ValidatedResponse` class from `src/index.ts`:

- Import `ValidationAdapter`, `InferOutput` from `./types`
- Export `ValidatedResponse`

### Task 4 — Create `src/prapti.ts`

Extract `Prapti` class and `createPrapti` from `src/index.ts`:

- Import `ValidationAdapter` from `./types`
- Import `PraptiOptions`, `InferOutput` from `./types`
- Import `ValidatedResponse` from `./response`
- Export `Prapti`, `createPrapti`

### Task 5 — Rewrite `src/index.ts` as a barrel

Replace the monolith with clean re-exports:

```ts
export { adapters } from "./adapters";
export { ValidatedResponse } from "./response";
export { Prapti, createPrapti } from "./prapti";
export type { ValidationAdapter, InferOutput, PraptiOptions } from "./types";
```

### Task 6 — Delete dead code

- Delete `src/adapters/valibot.ts`
- Delete `src/adapters/` directory if empty

### Task 7 — Promote `test/fixes/` tests

- Move `test/fixes/adapters.test.ts` → `test/adapters.test.ts`
  - Update import: `../../src/index` → `../src/index`
- Move `test/fixes/prapti-class.test.ts` → `test/prapti.test.ts`
  - Update import: `../../src/index` → `../src/index`
- Move `test/fixes/validated-response.test.ts` → `test/validated-response.test.ts`
  - Update import: `../../src/index` → `../src/index`
- Delete `test/fixes/` directory

### Task 8 — Rename `test/index.test.ts` → `test/integration.test.ts`

- Update import if any relative paths are affected

### Task 9 — Verify all tests pass

```
bun test
```

All tests must pass before considering the restructuring complete.

### Task 10 — Verify build

```
bun run build
```

Output: `dist/index.cjs.js`, `dist/index.esm.js`, `dist/index.d.ts` — no errors.

---

## Constraints

- Public API surface must not change (same exports from `src/index.ts`)
- No logic changes — pure structural move
- No new dependencies
