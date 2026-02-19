# Prapti Restructuring Plan — 2026-02-19

## Goal

Split the monolithic `src/index.ts` (656 lines) into logical, maintainable modules. Remove dead code. Merge `test/fixes/` unit tests into canonical test files.

## Current State

```
src/
├── index.ts          ← 656-line monolith (types + adapters + ValidatedResponse + Prapti + exports)
└── adapters/
    └── valibot.ts    ← DEAD FILE (incorrect valibot API, unused)

test/
├── index.test.ts          ← integration tests (jsonplaceholder)
├── form-data.test.ts      ← FormData/URLSearchParams integration
├── headers.test.ts        ← header validation integration
└── fixes/
    ├── adapters.test.ts          ← adapter unit tests
    ├── prapti-class.test.ts      ← Prapti unit tests
    └── validated-response.test.ts ← ValidatedResponse unit tests
```

## Target State

```
src/
├── types.ts          ← ValidationAdapter, InferOutput, PraptiOptions
├── adapters.ts       ← ZodSchema, YupSchema, ValibotSchema types + adapters object
├── response.ts       ← ValidatedResponse class
├── prapti.ts         ← Prapti class + createPrapti factory
└── index.ts          ← public API re-exports only

test/
├── integration.test.ts      ← (was index.test.ts)
├── form-data.test.ts        ← unchanged
├── headers.test.ts          ← unchanged
├── adapters.test.ts         ← (was fixes/adapters.test.ts)
├── prapti.test.ts           ← (was fixes/prapti-class.test.ts)
└── validated-response.test.ts ← (was fixes/validated-response.test.ts)
```

---

## Task 1: Create `src/types.ts`

**File to create:** `src/types.ts`

Extract from `src/index.ts` lines 14–73:
- `ValidationAdapter<TSchema>` interface
- `InferOutput<T>` type
- `PraptiOptions<TReqSchema, TResSchema, TReqHeadersSchema, TResHeadersSchema>` type

Contents:

```ts
export type ValidationAdapter<TSchema> = {
  parse(schema: TSchema, data: unknown): unknown;
};

export type InferOutput<T> = T extends import("zod").ZodType<infer O>
  ? O
  : T extends { __outputType: infer O }
  ? O
  : T extends { "~standard": { types?: { output?: infer O } } }
  ? O
  : T extends (...args: any[]) => infer O
  ? O
  : unknown;

export type PraptiOptions<
  TReqSchema = unknown,
  TResSchema = unknown,
  TReqHeadersSchema = unknown,
  TResHeadersSchema = unknown,
> = Omit<RequestInit, "body" | "headers"> & {
  body?: BodyInit | null | Record<string, unknown> | unknown[];
  headers?: HeadersInit | Record<string, string>;
  requestSchema?: TReqSchema;
  responseSchema?: TResSchema;
  requestHeadersSchema?: TReqHeadersSchema;
  responseHeadersSchema?: TResHeadersSchema;
};
```

**Steps:**
1. Create `src/types.ts` with content above (exact types from index.ts)
2. Run `bun run build` — expect it to still work (types not yet removed from index.ts)
3. Remove the type definitions from `src/index.ts` and replace with `import { ValidationAdapter, InferOutput, PraptiOptions } from "./types"`
4. Run `bun run build` again — must succeed
5. Commit

---

## Task 2: Create `src/adapters.ts`

**File to create:** `src/adapters.ts`

Extract from `src/index.ts` lines 575–645:
- `ZodSchema<O>` type
- `YupSchema<O>` type
- `ValibotResult<O>` type
- `ValibotSchema<O>` type
- `adapters` const object with `.zod`, `.yup`, `.valibot`

Import `ValidationAdapter` from `./types`.

**Steps:**
1. Create `src/adapters.ts` with the adapter types and `adapters` object
2. Remove adapter code from `src/index.ts`, import from `./adapters`
3. Run `bun run build` — must succeed
4. Run `bun test` — all tests must pass
5. Commit

---

## Task 3: Create `src/response.ts`

**File to create:** `src/response.ts`

Extract from `src/index.ts` lines 83–296: the `ValidatedResponse` class.

Import `ValidationAdapter`, `InferOutput` from `./types`.

**Steps:**
1. Create `src/response.ts` with `ValidatedResponse` class
2. Remove `ValidatedResponse` from `src/index.ts`, import from `./response`
3. Run `bun run build` — must succeed
4. Run `bun test` — all tests must pass
5. Commit

---

## Task 4: Create `src/prapti.ts`

**File to create:** `src/prapti.ts`

Extract from `src/index.ts` lines 306–572: the `Prapti` class and `createPrapti` factory.

Import `ValidationAdapter`, `InferOutput`, `PraptiOptions` from `./types`.
Import `ValidatedResponse` from `./response`.

**Steps:**
1. Create `src/prapti.ts` with `Prapti` class and `createPrapti`
2. Remove them from `src/index.ts`, import from `./prapti`
3. Run `bun run build` — must succeed
4. Run `bun test` — all tests must pass
5. Commit

---

## Task 5: Slim down `src/index.ts` to re-exports only

After Tasks 1–4, `src/index.ts` should only contain re-exports:

```ts
export { adapters } from "./adapters";
export { Prapti, createPrapti } from "./prapti";
export { ValidatedResponse } from "./response";
export type { InferOutput, PraptiOptions, ValidationAdapter } from "./types";
```

**Steps:**
1. Replace `src/index.ts` content with pure re-exports
2. Run `bun run build` — must succeed
3. Run `bun test` — all tests must pass
4. Commit

---

## Task 6: Delete dead file `src/adapters/valibot.ts`

The file uses incorrect Valibot API (`valibot.parse(schema, data)`) and is completely unused. The correct adapter is already in `src/adapters.ts`.

**Steps:**
1. Delete `src/adapters/valibot.ts`
2. Run `bun run build` — must succeed
3. Commit

---

## Task 7: Reorganize test files

Move `test/fixes/` unit tests to top-level `test/` and rename `test/index.test.ts`.

Mapping:
- `test/index.test.ts` → `test/integration.test.ts`
- `test/fixes/adapters.test.ts` → `test/adapters.test.ts`
- `test/fixes/prapti-class.test.ts` → `test/prapti.test.ts`
- `test/fixes/validated-response.test.ts` → `test/validated-response.test.ts`

Update import paths in moved files (remove `../../` prefix, use `../src/index`).

**Steps:**
1. Copy files to new locations with updated imports
2. Delete `test/fixes/` directory and `test/index.test.ts`
3. Run `bun test` — all tests must pass
4. Commit

---

## Notes

- The public API surface (exports from `src/index.ts`) must not change — no breaking changes
- Build output targets: `dist/index.cjs.js`, `dist/index.esm.js`, `dist/index.d.ts`
- Size limit: 5KB each for CJS and ESM
- All tests must pass after each task
