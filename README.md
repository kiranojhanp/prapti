![prapti](media/logo.png)

# Prapti

_"प्राप्ति" (Prapti) - Sanskrit for "fetch" or "obtain"_

> A minimal, type-safe utility that extends the native `fetch` API with runtime schema validation.

![NPM Version](https://img.shields.io/npm/v/prapti)
[![npm min + gzip size](https://badgen.net/bundlephobia/minzip/prapti)](https://bundlephobia.com/result?p=prapti)
[![License](https://img.shields.io/badge/License-MIT-blue)](#license)
[![issues - prapti](https://img.shields.io/github/issues/kiranojhanp/prapti)](https://github.com/kiranojhanp/prapti/issues)

```typescript
// Without Prapti
const response = await fetch("/api/users");
const data = await response.json(); // any type
const validatedData = UserSchema.parse(data); // manual validation

// With Prapti
const { fetch } = prapti(zodAdapter);
const response = await fetch("/api/users", {
  validate: { response: { body: UserSchema } },
});
const data = await response.json(); // fully typed + validated
```

<details>
<summary>Why switch from <code>fetch</code>?</summary>

- **Stop writing `any` types** — automatic TypeScript inference from your schemas, no manual type assertions.
- **Catch API breaks at runtime** — validate responses against your schema and know immediately when APIs change.
- **Eliminate validation boilerplate** — no more `schema.parse(await response.json())` on every call.
- **Drop-in replacement** — same API as `fetch()` with optional validation. Add it only where you need it.
- **Use any validation library** — bring your own: Zod, Valibot, Yup, or a custom adapter.

</details>

## Install

```bash
npm install prapti zod
```

## Usage

```typescript
import { prapti } from "prapti";
import { zodAdapter } from "prapti/adapters/zod";
import { z } from "zod";

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

const { fetch } = prapti(zodAdapter);

// GET with response validation
const response = await fetch("/api/users/1", {
  validate: { response: { body: UserSchema } },
});
const user = await response.json(); // Type: { id: number; name: string; email: string }

// POST with request + response validation
const CreateUserSchema = UserSchema.omit({ id: true });

const newUser = await fetch("/api/users", {
  method: "POST",
  body: { name: "John", email: "john@example.com" },
  validate: {
    request: { body: CreateUserSchema },
    response: { body: UserSchema },
  },
});
```

<details>
<summary>Header validation</summary>

```typescript
const RequestHeadersSchema = z.object({
  authorization: z.string().startsWith("Bearer "),
  "content-type": z.literal("application/json"),
});

const ResponseHeadersSchema = z.object({
  "content-type": z.string().includes("json"),
  "x-rate-limit-remaining": z.string().transform(Number).pipe(z.number()),
});

const response = await fetch("/api/users", {
  headers: {
    Authorization: "Bearer token123",
    "Content-Type": "application/json",
  },
  validate: {
    request: { headers: RequestHeadersSchema },
    response: { headers: ResponseHeadersSchema },
  },
});

// Get typed and validated headers
const headers = response.validatedHeaders;
console.log(`Rate limit remaining: ${headers["x-rate-limit-remaining"]}`);
```

</details>

## Adapters

Import only the adapter you use — unused adapters are not included in your bundle.

```typescript
import { zodAdapter } from "prapti/adapters/zod"; // Zod
import { yupAdapter } from "prapti/adapters/yup"; // Yup
import { valibotAdapter } from "prapti/adapters/valibot"; // Valibot
```

<details>
<summary>Custom adapter</summary>

Implement the `ValidationAdapter` interface to use any validation library:

```typescript
import type { ValidationAdapter } from "prapti";

const customAdapter: ValidationAdapter<MySchema> = {
  parse: (schema, data) => schema.validate(data),
};

const { fetch } = prapti(customAdapter);
```

</details>

## API

<details>
<summary><code>prapti(adapter)</code></summary>

Factory function. Pass a validation adapter and get back an enhanced `fetch`.

```typescript
const { fetch } = prapti(zodAdapter);
```

</details>

<details>
<summary><code>PraptiOptions</code></summary>

All native `RequestInit` options plus a single `validate` block:

```typescript
validate?: {
  request?: { body?: Schema; headers?: Schema };
  response?: { body?: Schema; headers?: Schema };
}
```

| Key                         | Description                            |
| --------------------------- | -------------------------------------- |
| `validate.request.body`     | Validate the outgoing request body     |
| `validate.request.headers`  | Validate the outgoing request headers  |
| `validate.response.body`    | Validate the incoming response body    |
| `validate.response.headers` | Validate the incoming response headers |

</details>

<details>
<summary><code>ValidatedResponse</code></summary>

Extends the native `Response` with validation support.

| Method / Property  | Description                                  |
| ------------------ | -------------------------------------------- |
| `json()`           | Parse and validate JSON response body        |
| `text()`           | Parse text (no validation)                   |
| `blob()`           | Get blob (no validation)                     |
| `arrayBuffer()`    | Get buffer (no validation)                   |
| `formData()`       | Parse and validate form data                 |
| `validatedHeaders` | Validated response headers as a typed object |

</details>

## Error Handling

```typescript
try {
  const response = await fetch("/api/users", {
    validate: { response: { body: UserSchema } },
  });
  const users = await response.json();
} catch (error) {
  // Validation errors thrown by your schema library
  // Network errors from fetch
}
```

## License

Released under [MIT](/LICENSE) by [@kiranojhanp](https://github.com/kiranojhanp).

---

<div align="center">
Made with love from 🇳🇵
</div>
