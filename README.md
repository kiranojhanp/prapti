![prapti](media/logo.png)

# Prapti 🚀

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
const { fetch: safeFetch } = createPrapti(adapters.zod);
const response = await safeFetch("/api/users", {
  responseSchema: UserSchema,
});
const data = await response.json(); // fully typed + validated
```

## Why switch from `fetch`?

**🎯 Stop writing `any` types**  
Get automatic TypeScript inference from your schemas. No more manual type assertions.

**🛡️ Catch API breaks at runtime**  
Validate responses against your schema. Know immediately when APIs change unexpectedly.

**🔧 Eliminate validation boilerplate**  
No more `schema.parse(await response.json())` on every API call. It's built-in.

**⚡ Drop-in replacement**  
Same API as `fetch()` with optional superpowers. Add validation only where you need it.

**🎨 Use any validation library**  
Bring your own: Zod, Valibot, Yup, Joi, or build custom adapters.

## Install

```bash
npm install prapti zod
```

## Usage

```typescript
import { createPrapti, adapters } from "prapti";
import { z } from "zod";

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

// Create client with Zod adapter
const { fetch: safeFetch } = createPrapti(adapters.zod);

// GET with response validation
const response = await safeFetch("/api/users/1", {
  responseSchema: UserSchema,
});
const user = await response.json(); // Type: { id: number, name: string, email: string }

// POST with request + response validation
const CreateUserSchema = UserSchema.omit({ id: true });

const newUser = await safeFetch("/api/users", {
  method: "POST",
  body: { name: "John", email: "john@example.com" },
  requestSchema: CreateUserSchema,
  responseSchema: UserSchema,
});

// With header validation
const RequestHeadersSchema = z.object({
  authorization: z.string().startsWith("Bearer "),
  "content-type": z.literal("application/json"),
});

const ResponseHeadersSchema = z.object({
  "content-type": z.string().includes("json"),
  "x-rate-limit-remaining": z.string().transform(Number).pipe(z.number()),
});

const response = await safeFetch("/api/users", {
  headers: {
    Authorization: "Bearer token123",
    "Content-Type": "application/json",
  },
  requestHeadersSchema: RequestHeadersSchema,
  responseHeadersSchema: ResponseHeadersSchema,
});

// Get typed and validated headers
const headers = response.getValidatedHeaders();
console.log(`Rate limit remaining: ${headers["x-rate-limit-remaining"]}`);
```

## API

### `Prapti(adapter)`

Main client class. Pass a validation adapter for your schema library.

**Available adapters:**

- `adapters.zod` - for Zod schemas

**Methods:**

- `fetch(url, options)` - Enhanced fetch with validation

### `PraptiOptions`

Extended fetch options with validation schemas:

- `requestSchema` - Schema to validate request body
- `responseSchema` - Schema to validate response data
- `requestHeadersSchema` - Schema to validate request headers
- `responseHeadersSchema` - Schema to validate response headers

### `ValidatedResponse`

Enhanced Response with validation:

- `json()` - Parse and validate JSON
- `text()` - Parse and validate text
- `blob()` - Get blob (no validation)
- `arrayBuffer()` - Get buffer (no validation)
- `formData()` - Parse and validate form data
- `getValidatedHeaders()` - Get validated headers as typed object

## Custom Adapters

```typescript
const customAdapter = {
  parse: <T>(schema: MySchema, data: unknown): T => {
    return schema.validate(data);
  },
};

const { fetch: safeFetch } = createPrapti(customAdapter);
```

## Error Handling

```typescript
try {
  const response = await safeFetch("/api/users", {
    responseSchema: UserSchema,
  });
  const users = await response.json();
} catch (error) {
  // Validation errors from your schema library
  // Network errors from fetch
}
```

## Upcoming Features

- 🔄 **Built-in adapters for Valibot, Yup, Joi, AJV**
- 🎨 **Custom adapter utilities and helpers**
- 🔄 **Streaming response validation**

## License

Released under [MIT](/LICENSE) by [@kiranojhanp](https://github.com/kiranojhanp).

---

<div align="center">
Made with ❤️ from 🇳🇵
</div>
