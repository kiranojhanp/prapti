# Prapti 🚀

_"प्राप्ति" (Prapti) - Sanskrit for "fetch" or "obtain"_

A minimal, type-safe HTTP client that extends the native `fetch` API with runtime schema validation.

```typescript
// Without Prapti
const response = await fetch("/api/users");
const data = await response.json(); // any type
const validatedData = userSchema.parse(data); // manual validation

// With Prapti
const response = await prapti.fetch("/api/users", {
  responseSchema: UserSchema,
});
const data = await response.json(); // fully typed + validated
```

## Install

```bash
npm install prapti zod
```

## Usage

```typescript
import { Prapti, adapters } from "prapti";
import { z } from "zod";

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

// Create client with Zod adapter
const prapti = new Prapti(adapters.zod);

// GET with response validation
const response = await prapti.fetch("/api/users/1", {
  responseSchema: UserSchema,
});
const user = await response.json(); // Type: { id: number, name: string, email: string }

// POST with request + response validation
const CreateUserSchema = UserSchema.omit({ id: true });

const newUser = await prapti.fetch("/api/users", {
  method: "POST",
  body: { name: "John", email: "john@example.com" },
  requestSchema: CreateUserSchema,
  responseSchema: UserSchema,
});
```

## API

### `Prapti(adapter)`

Main client class. Pass a validation adapter for your schema library.

**Available adapters:**

- `adapters.zod` - for Zod schemas

**Methods:**

- `fetch(url, options)` - Enhanced fetch with validation

### `PraptiOptions`

Standard fetch options plus:

- `requestSchema?` - Schema to validate request body
- `responseSchema?` - Schema to validate response data

### `ValidatedResponse`

Enhanced Response with validation:

- `json()` - Parse and validate JSON
- `text()` - Parse and validate text
- `blob()` - Get blob (no validation)
- `arrayBuffer()` - Get buffer (no validation)
- `formData()` - Parse and validate form data

## Custom Adapters

```typescript
const customAdapter = {
  parse: <T>(schema: MySchema, data: unknown): T => {
    return schema.validate(data);
  },
};

const prapti = new Prapti(customAdapter);
```

## Error Handling

```typescript
try {
  const response = await prapti.fetch("/api/users", {
    responseSchema: UserSchema,
  });
  const users = await response.json();
} catch (error) {
  // Validation errors from your schema library
  // Network errors from fetch
}
```

## Upcoming Features

- 🔄 Built-in adapters for Valibot, Yup, Joi
- 🔄 Request/response interceptors
- 🔄 Retry logic with exponential backoff
- 🔄 Request cancellation with AbortController
- 🔄 Response caching
- 🔄 File upload helpers
- 🔄 Streaming response support

## License

MIT
