# Prapti 🚀

_"प्राप्ति" (Prapti) - Sanskrit for "fetch" or "obtain"_

A type-safe HTTP client library that extends the native `fetch` API with runtime schema validation support for popular validation libraries like Zod, Valibot, Yup, and more.

## Problem Statement

Modern web applications require robust type safety and runtime validation when communicating with APIs. However, the native `fetch` API lacks:

1. **Runtime Type Safety**: No validation of request/response data at runtime
2. **Schema Integration**: No built-in support for popular validation libraries
3. **Type Inference**: Manual type assertions required for response data
4. **Consistent Error Handling**: Validation errors mixed with network errors
5. **Developer Experience**: Repetitive validation boilerplate in every API call

### Common Pain Points

```typescript
// ❌ Without Prapti - Manual validation, no type inference
const response = await fetch("/api/users", {
  method: "POST",
  body: JSON.stringify(userData),
  headers: { "Content-Type": "application/json" },
});

const data = await response.json(); // any type
// Manual validation required
const validatedData = userSchema.parse(data); // Repetitive boilerplate
```

```typescript
// ✅ With Prapti - Automatic validation, full type inference
const response = await prapti.fetch("/api/users", {
  method: "POST",
  body: userData,
  requestSchema: CreateUserSchema,
  responseSchema: UserSchema,
});

const data = await response.json(); // Fully typed User object
```

## How Runtime Validation Solves These Issues

Runtime validation libraries like **Zod**, **Valibot**, **Yup**, and **Joi** provide:

- **Type Safety**: Compile-time types + runtime validation
- **Error Reporting**: Detailed validation error messages
- **Schema Reuse**: Single source of truth for data structure
- **Transformation**: Data parsing, coercion, and sanitization
- **Composition**: Complex schema building from simple primitives

Prapti integrates seamlessly with these libraries through a unified adapter interface.

## Installation

```bash
npm install prapti

# Install your preferred validation library
npm install zod          # For Zod
npm install valibot      # For Valibot
npm install yup          # For Yup
npm install joi          # For Joi
```

## Quick Start

### With Zod

```typescript
import { SafeFetch } from "prapti";
import { z } from "zod";

// Define your schemas
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

// Create Zod adapter
const zodAdapter = {
  parse: <T>(schema: z.ZodSchema, data: unknown): T => schema.parse(data) as T,
};

// Initialize Prapti with Zod
const prapti = new SafeFetch(zodAdapter);

// Make type-safe API calls
const response = await prapti.fetch("/api/users", {
  method: "POST",
  body: { name: "John", email: "john@example.com" },
  requestSchema: CreateUserSchema,
  responseSchema: UserSchema,
});

const user = await response.json(); // Fully typed as User
```

### With Valibot

```typescript
import { SafeFetch } from "prapti";
import * as v from "valibot";

const UserSchema = v.object({
  id: v.number(),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
});

const valibotAdapter = {
  parse: <T>(schema: v.BaseSchema, data: unknown): T =>
    v.parse(schema, data) as T,
};

const prapti = new SafeFetch(valibotAdapter);
```

### With Yup

```typescript
import { SafeFetch } from "prapti";
import * as yup from "yup";

const UserSchema = yup.object({
  id: yup.number().required(),
  name: yup.string().required(),
  email: yup.string().email().required(),
});

const yupAdapter = {
  parse: <T>(schema: yup.Schema, data: unknown): T =>
    schema.validateSync(data) as T,
};

const prapti = new SafeFetch(yupAdapter);
```

## API Reference

### `SafeFetch<TSchema>`

The main class that wraps the native fetch API with validation capabilities.

#### Constructor

```typescript
constructor(adapter: ValidationAdapter<TSchema>)
```

#### Methods

##### `fetch<TResponseSchema>(input, options)`

Makes an HTTP request with optional request/response validation.

```typescript
async fetch<TResponseSchema extends TSchema = never>(
  input: RequestInfo | URL,
  options?: SafeFetchOptions<TSchema, TResponseSchema>
): Promise<ValidatedResponse<InferOutput<TResponseSchema>>>
```

**Parameters:**

- `input`: Request URL or Request object
- `options`: Extended fetch options with validation schemas

**Returns:** `ValidatedResponse` with type-safe methods

### `SafeFetchOptions<TRequestSchema, TResponseSchema>`

Extended fetch options with validation schema support.

```typescript
interface SafeFetchOptions<TRequestSchema, TResponseSchema>
  extends Omit<RequestInit, "body"> {
  body?: BodyInit | null | unknown;
  requestSchema?: TRequestSchema;
  responseSchema?: TResponseSchema;
}
```

### `ValidatedResponse<T>`

Extended Response class with validation-aware methods.

#### Methods

- `json(): Promise<T>` - Parse JSON with validation
- `text(): Promise<string>` - Parse text with validation
- `blob(): Promise<Blob>` - Get blob (no validation)
- `arrayBuffer(): Promise<ArrayBuffer>` - Get array buffer (no validation)
- `formData(): Promise<FormData>` - Parse form data with validation

### `ValidationAdapter<TSchema>`

Adapter interface for integrating validation libraries.

```typescript
interface ValidationAdapter<TSchema = unknown> {
  parse<T>(schema: TSchema, data: unknown): T;
}
```

### Type Utilities

#### `InferOutput<T>`

Helper type to infer the output type from various schema formats.

```typescript
type InferOutput<T> = T extends { _output: infer U }
  ? U // Zod
  : T extends { _type: infer U }
  ? U // Valibot
  : T extends (...args: any[]) => infer U
  ? U // Functions
  : unknown;
```

## Advanced Usage

### Custom Error Handling

```typescript
try {
  const response = await prapti.fetch("/api/users/1", {
    responseSchema: UserSchema,
  });
  const user = await response.json();
} catch (error) {
  if (error.name === "ZodError") {
    // Handle validation errors
    console.error("Validation failed:", error.errors);
  } else {
    // Handle network errors
    console.error("Network error:", error.message);
  }
}
```

### Middleware Pattern

```typescript
class PraptiWithMiddleware extends SafeFetch {
  async fetch(input, options) {
    // Pre-request middleware
    console.log("Making request to:", input);

    const response = await super.fetch(input, options);

    // Post-response middleware
    console.log("Response status:", response.status);

    return response;
  }
}
```

### Generic Response Types

```typescript
// For APIs returning different response shapes
async function apiCall<T>(
  endpoint: string,
  schema: z.ZodSchema<T>
): Promise<T> {
  const response = await prapti.fetch(endpoint, {
    responseSchema: schema,
  });
  return response.json();
}

const user = await apiCall("/users/1", UserSchema);
const posts = await apiCall("/posts", PostArraySchema);
```

## Best Practices

1. **Define Schemas Once**: Create reusable schema definitions
2. **Handle Errors Gracefully**: Distinguish between validation and network errors
3. **Use Type Inference**: Let TypeScript infer types from schemas
4. **Validate Early**: Use request schemas to catch errors before sending
5. **Keep Adapters Simple**: Minimal wrapper around validation libraries

## Examples

### Complete CRUD Operations

```typescript
import { SafeFetch } from "prapti";
import { z } from "zod";

// Schemas
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

const CreateUserSchema = UserSchema.omit({ id: true, createdAt: true });
const UpdateUserSchema = CreateUserSchema.partial();

// Setup
const zodAdapter = {
  parse: <T>(schema: z.ZodSchema, data: unknown): T => schema.parse(data) as T,
};
const api = new SafeFetch(zodAdapter);

// CRUD Operations
class UserService {
  async getUser(id: number) {
    const response = await api.fetch(`/users/${id}`, {
      responseSchema: UserSchema,
    });
    return response.json(); // Type: User
  }

  async createUser(userData: z.infer<typeof CreateUserSchema>) {
    const response = await api.fetch("/users", {
      method: "POST",
      body: userData,
      requestSchema: CreateUserSchema,
      responseSchema: UserSchema,
    });
    return response.json(); // Type: User
  }

  async updateUser(id: number, updates: z.infer<typeof UpdateUserSchema>) {
    const response = await api.fetch(`/users/${id}`, {
      method: "PATCH",
      body: updates,
      requestSchema: UpdateUserSchema,
      responseSchema: UserSchema,
    });
    return response.json(); // Type: User
  }

  async deleteUser(id: number) {
    return api.fetch(`/users/${id}`, {
      method: "DELETE",
    });
  }
}
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

_Prapti brings type safety and validation to HTTP requests, making your API interactions more reliable and developer-friendly._
