import { describe, test, expect, beforeAll } from "bun:test";
import { Prapti } from "../src/index";
import { zodAdapter } from "../src/adapters/zod";
import { z } from "zod";

describe("Header validation with Zod", () => {
  let prapti: Prapti<z.ZodSchema>;

  beforeAll(() => {
    prapti = new Prapti(zodAdapter);
  });

  describe("Request header validation", () => {
    test("should validate and send request headers", async () => {
      const RequestHeadersSchema = z.object({
        "content-type": z.string(),
        "x-api-key": z.string().min(10),
        "user-agent": z.string().optional(),
      });

      const headers = {
        "Content-Type": "application/json",
        "X-API-Key": "valid-api-key-123",
        "User-Agent": "Prapti/1.0",
      };

      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/posts/1",
        {
          validate: { request: { headers: RequestHeadersSchema } },
          headers,
        }
      );

      expect(response.ok).toBe(true);
    });

    test("should reject invalid request headers", async () => {
      const RequestHeadersSchema = z.object({
        "x-api-key": z.string().min(20), // Require at least 20 characters
      });

      const headers = {
        "X-API-Key": "short", // Too short, should fail validation
      };

      await expect(
        prapti.fetch("https://jsonplaceholder.typicode.com/posts/1", {
          validate: { request: { headers: RequestHeadersSchema } },
          headers,
        })
      ).rejects.toThrow(); // Should throw Zod validation error
    });

    test("should handle Headers object in request", async () => {
      const RequestHeadersSchema = z.object({
        authorization: z.string().startsWith("Bearer "),
      });

      const headers = new Headers();
      headers.set("Authorization", "Bearer valid-token-123");

      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/posts/1",
        {
          validate: { request: { headers: RequestHeadersSchema } },
          headers,
        }
      );

      expect(response.ok).toBe(true);
    });

    test("should handle array format headers in request", async () => {
      const RequestHeadersSchema = z.object({
        accept: z.string(),
        "cache-control": z.string(),
      });

      const headers: [string, string][] = [
        ["Accept", "application/json"],
        ["Cache-Control", "no-cache"],
      ];

      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/posts/1",
        {
          validate: { request: { headers: RequestHeadersSchema } },
          headers,
        }
      );

      expect(response.ok).toBe(true);
    });
  });

  describe("Response header validation", () => {
    test("should validate response headers", async () => {
      const ResponseHeadersSchema = z.object({
        "content-type": z.string().includes("json"),
        "cache-control": z.string().optional(),
        etag: z.string().optional(),
      });

      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/posts/1",
        {
          validate: { response: { headers: ResponseHeadersSchema } },
        }
      );

      expect(response.ok).toBe(true);

      // Get validated headers with full type safety
      const validatedHeaders = response.validatedHeaders;
      expect(validatedHeaders["content-type"]).toContain("json");
    });

    test("should provide typed access to validated response headers", async () => {
      const ResponseHeadersSchema = z.object({
        "content-type": z.string(),
        "content-length": z.string().optional(),
      });

      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/posts/1",
        {
          validate: { response: { headers: ResponseHeadersSchema } },
        }
      );

      const headers = response.validatedHeaders as z.infer<typeof ResponseHeadersSchema>;

      // TypeScript should know these types
      expect(typeof headers["content-type"]).toBe("string");
      expect(headers["content-type"]).toContain("json");
    });

    test("should handle response header validation errors", async () => {
      const StrictResponseHeadersSchema = z.object({
        "content-type": z.string(),
        "x-custom-required-header": z.string(), // This header won't exist
      });

      await expect(
        prapti.fetch("https://jsonplaceholder.typicode.com/posts/1", {
          validate: { response: { headers: StrictResponseHeadersSchema } },
        })
      ).rejects.toThrow(); // Should throw when required header is missing
    });

    test("should normalize header names to lowercase", async () => {
      const ResponseHeadersSchema = z.object({
        "content-type": z.string(),
      });

      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/posts/1",
        {
          validate: { response: { headers: ResponseHeadersSchema } },
        }
      );

      const headers = response.validatedHeaders;

      // Headers should be normalized to lowercase
      expect(headers).toHaveProperty("content-type");
      expect(headers["content-type"]).toBeDefined();
    });
  });

  describe("Combined header and body validation", () => {
    test("should validate both request headers and body", async () => {
      const RequestHeadersSchema = z.object({
        "content-type": z.literal("application/json"),
        "x-api-version": z.string(),
      });

      const CreatePostSchema = z.object({
        title: z.string().min(1),
        body: z.string().min(1),
        userId: z.number().positive(),
      });

      const PostSchema = z.object({
        id: z.number(),
        title: z.string(),
        body: z.string(),
        userId: z.number(),
      });

      const headers = {
        "Content-Type": "application/json",
        "X-API-Version": "v1",
      };

      const requestBody = {
        title: "Test Post",
        body: "This is a test post",
        userId: 1,
      };

      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/posts",
        {
          method: "POST",
          headers,
          body: requestBody,
          validate: {
            request: { body: CreatePostSchema, headers: RequestHeadersSchema },
            response: { body: PostSchema },
          },
        }
      );

      expect(response.ok).toBe(true);
      const post = await response.json();
      expect(post.title).toBe(requestBody.title);
    });

    test("should validate both response headers and body", async () => {
      const ResponseHeadersSchema = z.object({
        "content-type": z.string().includes("json"),
        server: z.string().optional(),
      });

      const UserSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email(),
      });

      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/users/1",
        {
          validate: { response: { body: UserSchema, headers: ResponseHeadersSchema } },
        }
      );

      expect(response.ok).toBe(true);

      // Both headers and body should be validated and typed
      const headers = response.validatedHeaders;
      const user = await response.json();

      expect(headers["content-type"]).toContain("json");
      expect(user.id).toBe(1);
      expect(typeof user.name).toBe("string");
    });
  });

  describe("Header schema transformations", () => {
    test("should handle header transformations", async () => {
      const TransformedHeadersSchema = z
        .object({
          "content-type": z.string(),
          "content-length": z.string().optional(),
        })
        .transform((headers) => ({
          ...headers,
          isJson: headers["content-type"].includes("json"),
          hasLength: !!headers["content-length"],
        }));

      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/posts/1",
        {
          validate: { response: { headers: TransformedHeadersSchema } },
        }
      );

      // Headers should be automatically typed with proper transformations
      const transformedHeaders = response.validatedHeaders;
      expect(typeof transformedHeaders.isJson).toBe("boolean");
      expect(typeof transformedHeaders.hasLength).toBe("boolean");
      expect(transformedHeaders.isJson).toBe(true);
    });
  });
});
