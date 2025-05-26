![prapti](media/logo.png)

# Prapti 🚀

_"प्राप्ति" (Prapti) - Sanskrit for "fetch" or "obtain"_

> A minimal, type-safe HTTP client that extends the native `fetch` API with runtime schema validation.

```typescript
// Without Prapti
const response = await safeFetch("/api/users");
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
- 🛡️ **Enhanced error types with validation details**
- 🎯 **Header validation with schemas**
- ⚡ **Zero-config TypeScript integration**
- 📦 **FormData and URLSearchParams validation**
- 🔄 **Streaming response validation**

## License

MIT

---

<div align="center">
Made with ❤️ from 🇳🇵
</div>
