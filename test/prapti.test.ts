import { describe, expect, test, mock, beforeAll, afterAll } from "bun:test";
import type { SerializationAdapter } from "../src/index";
import { Prapti } from "../src/index";
import { zodAdapter } from "../src/adapters/zod";
import { z } from "zod";

describe("Prapti Class Fixes", () => {
  const prapti = new Prapti(zodAdapter);
  const originalFetch = global.fetch;

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("should preserve headers when no requestHeadersSchema is provided", async () => {
    let capturedHeaders: Headers | undefined;
    
    // @ts-ignore
    global.fetch = mock(async (input, init) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true }));
    });

    await prapti.fetch("https://api.example.com", {
      headers: {
        "X-Custom-Header": "custom-value",
        "Authorization": "Bearer token"
      }
    });

    expect(capturedHeaders?.get("x-custom-header")).toBe("custom-value");
    expect(capturedHeaders?.get("authorization")).toBe("Bearer token");
  });

  test("should drop non-validated headers even if headerValidationMode is provided", async () => {
    let capturedHeaders: Headers | undefined;
    
    // @ts-ignore
    global.fetch = mock(async (input, init) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true }));
    });

    const headersSchema = z.object({
      "x-validated": z.string()
    });

    const preservePrapti = new Prapti(zodAdapter, { headerValidationMode: "preserve" } as any);

    await preservePrapti.fetch("https://api.example.com", {
      headers: {
        "x-validated": "valid",
        "x-preserved": "preserved"
      },
      validate: { request: { headers: headersSchema } }
    });

    expect(capturedHeaders?.get("x-validated")).toBe("valid");
    expect(capturedHeaders?.get("x-preserved")).toBeNull();
  });

  test("should handle plain object body without schema correctly (JSON)", async () => {
    let capturedBody: any;
    let capturedHeaders: Headers | undefined;
    
    // @ts-ignore
    global.fetch = mock(async (input, init) => {
      capturedBody = init?.body;
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true }));
    });

    const payload = { foo: "bar" };
    // @ts-ignore
    await prapti.fetch("https://api.example.com", {
      method: "POST",
      body: payload
    });

    // Current bug: body becomes "[object Object]"
    // Expectation: body becomes '{"foo":"bar"}'
    expect(capturedBody).toBe(JSON.stringify(payload));
    
    // Current bug: Content-Type missing
    // Expectation: Content-Type: application/json
    expect(capturedHeaders?.get("content-type")).toBe("application/json");
  });

  test("should NOT override existing Content-Type for JSON body", async () => {
    let capturedHeaders: Headers | undefined;
    
    // @ts-ignore
    global.fetch = mock(async (input, init) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true }));
    });

    await prapti.fetch("https://api.example.com", {
      method: "POST",
      body: { foo: "bar" },
      headers: {
        "Content-Type": "application/vnd.api+json"
      }
    });

    expect(capturedHeaders?.get("content-type")).toBe("application/vnd.api+json");
  });

  test("should send raw string body when schema expects string and content-type is text", async () => {
    let capturedBody: any;
    let capturedHeaders: Headers | undefined;

    // @ts-ignore
    global.fetch = mock(async (input, init) => {
      capturedBody = init?.body;
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true }));
    });

    const bodySchema = z.string().min(1);

    await prapti.fetch("https://api.example.com", {
      method: "POST",
      body: "hello world",
      headers: {
        "Content-Type": "text/plain",
      },
      validate: { request: { body: bodySchema } },
    });

    expect(capturedBody).toBe("hello world");
    expect(capturedHeaders?.get("content-type")).toBe("text/plain");
  });

  test("should throw when JSON content-type body is invalid JSON", async () => {
    // @ts-ignore
    global.fetch = mock(async () => {
      return new Response(JSON.stringify({ success: true }));
    });

    const bodySchema = z.object({ foo: z.string() });

    await expect(
      prapti.fetch("https://api.example.com", {
        method: "POST",
        body: "{invalid-json}",
        headers: {
          "Content-Type": "application/json",
        },
        validate: { request: { body: bodySchema } },
      })
    ).rejects.toThrow("Invalid JSON request body");
  });

  test("should not parse JSON when content-type is not validated", async () => {
    // @ts-ignore
    global.fetch = mock(async () => {
      return new Response(JSON.stringify({ success: true }));
    });

    const bodySchema = z.object({ foo: z.string() });
    const headersSchema = z.object({
      "x-validated": z.string(),
    });

    await expect(
      prapti.fetch("https://api.example.com", {
        method: "POST",
        body: "{invalid-json}",
        headers: {
          "Content-Type": "application/json",
          "x-validated": "ok",
        },
        validate: { request: { body: bodySchema, headers: headersSchema } },
      })
    ).rejects.toThrow("Expected object");
  });

  test("should skip undefined and null validated headers", async () => {
    let capturedHeaders: Headers | undefined;

    // @ts-ignore
    global.fetch = mock(async (input, init) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true }));
    });

    const headersSchema = z.object({
      "x-keep": z.string(),
      "x-null": z.literal("null").transform(() => null),
      "x-undefined": z.literal("undefined").transform(() => undefined),
    });

    await prapti.fetch("https://api.example.com", {
      headers: {
        "x-keep": "keep",
        "x-null": "null",
        "x-undefined": "undefined",
      },
      validate: { request: { headers: headersSchema } },
    });

    expect(capturedHeaders?.get("x-keep")).toBe("keep");
    expect(capturedHeaders?.get("x-null")).toBeNull();
    expect(capturedHeaders?.get("x-undefined")).toBeNull();
  });

  test("should not set content-type for validated JSON body when headers are validated", async () => {
    let capturedBody: any;
    let capturedHeaders: Headers | undefined;

    // @ts-ignore
    global.fetch = mock(async (input, init) => {
      capturedBody = init?.body;
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true }));
    });

    const bodySchema = z.object({ foo: z.string() });
    const headersSchema = z.object({
      "x-validated": z.string(),
    });

    await prapti.fetch("https://api.example.com", {
      method: "POST",
      body: { foo: "bar" },
      headers: {
        "x-validated": "ok",
      },
      validate: { request: { body: bodySchema, headers: headersSchema } },
    });

    expect(capturedBody).toBe(JSON.stringify({ foo: "bar" }));
    expect(capturedHeaders?.get("content-type")).toBeNull();
  });

  test("should treat vendor JSON content-type as JSON for invalid string bodies", async () => {
    // @ts-ignore
    global.fetch = mock(async () => {
      return new Response(JSON.stringify({ success: true }));
    });

    const bodySchema = z.object({ foo: z.string() });

    await expect(
      prapti.fetch("https://api.example.com", {
        method: "POST",
        body: "{invalid-json}",
        headers: {
          "Content-Type": "Application/Vnd.Api+Json",
        },
        validate: { request: { body: bodySchema } },
      })
    ).rejects.toThrow("Invalid JSON request body");
  });

  test("should not treat application/jsonp as JSON for string body schema", async () => {
    let capturedBody: any;

    // @ts-ignore
    global.fetch = mock(async (input, init) => {
      capturedBody = init?.body;
      return new Response(JSON.stringify({ success: true }));
    });

    const bodySchema = z.string().min(1);

    await prapti.fetch("https://api.example.com", {
      method: "POST",
      body: "{invalid-json}",
      headers: {
        "Content-Type": "application/jsonp",
      },
      validate: { request: { body: bodySchema } },
    });

    expect(capturedBody).toBe("{invalid-json}");
  });

  test("should use custom serializer for plain object bodies", async () => {
    let capturedBody: any;
    let capturedHeaders: Headers | undefined;

    const serializer: SerializationAdapter = {
      stringify: (value) => `custom:${JSON.stringify(value)}`,
      parse: (value) => JSON.parse(value.replace("custom:", "")),
      isJsonContentType: (contentType) =>
        contentType?.includes("application/json") ?? false,
    };

    const customPrapti = new Prapti(zodAdapter, { serializer });

    // @ts-ignore
    global.fetch = mock(async (input, init) => {
      capturedBody = init?.body;
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true }));
    });

    await customPrapti.fetch("https://api.example.com", {
      method: "POST",
      body: { foo: "bar" },
    });

    expect(capturedBody).toBe("custom:{\"foo\":\"bar\"}");
    expect(capturedHeaders?.get("content-type")).toBe("application/json");
  });

  test("should allow type-only usage for serialization", () => {
    const adapter: SerializationAdapter = {
      stringify: (value: unknown) => JSON.stringify(value),
      parse: (value: string) => JSON.parse(value),
      isJsonContentType: (contentType: string | null) => contentType === "application/json",
    };

    expect(adapter.parse(adapter.stringify({ ok: true }))).toEqual({ ok: true });
  });
});
