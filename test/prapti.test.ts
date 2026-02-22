import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import type {
  HeaderValidationMode,
  PraptiConfig,
  SerializationAdapter,
} from "../src/index";
import { Prapti } from "../src/index";
import { zodAdapter } from "../src/adapters/zod";
import { z } from "zod";
import { createFetchMock } from "./helpers/fetch-mock";

describe("Prapti Class Fixes", () => {
  const prapti = new Prapti(zodAdapter);
  const fetchMock = createFetchMock();

  beforeEach(() => {
    fetchMock.reset();
  });

  afterEach(() => {
    fetchMock.restore();
  });

  test("should preserve headers when no requestHeadersSchema is provided", async () => {
    let capturedHeaders: Headers | undefined;
    
    fetchMock.useMockFetch(async (input, init) => {
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

  test("should preserve non-validated headers when requestHeadersSchema is provided", async () => {
    let capturedHeaders: Headers | undefined;
    
    fetchMock.useMockFetch(async (input, init) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true }));
    });

    const headersSchema = z.object({
      "x-validated": z.string()
    });

    await prapti.fetch("https://api.example.com", {
      headers: {
        "x-validated": "valid",
        "x-preserved": "preserved"
      },
      validate: { request: { headers: headersSchema } }
    });

    expect(capturedHeaders?.get("x-validated")).toBe("valid");
    expect(capturedHeaders?.get("x-preserved")).toBe("preserved");
  });

  test("should drop non-validated headers in strict mode", async () => {
    let capturedHeaders: Headers | undefined;

    fetchMock.useMockFetch(async (input, init) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true }));
    });

    const headersSchema = z.object({
      "x-validated": z.string(),
    });

    const strictPrapti = new Prapti(zodAdapter, {
      headerValidationMode: "strict",
    });

    await strictPrapti.fetch("https://api.example.com", {
      headers: {
        "x-validated": "valid",
        "x-preserved": "preserved",
      },
      validate: { request: { headers: headersSchema } },
    });

    expect(capturedHeaders?.get("x-validated")).toBe("valid");
    expect(capturedHeaders?.get("x-preserved")).toBeNull();
  });

  test("should handle plain object body without schema correctly (JSON)", async () => {
    let capturedBody: any;
    let capturedHeaders: Headers | undefined;
    
    fetchMock.useMockFetch(async (input, init) => {
      capturedBody = init?.body;
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true }));
    });

    const payload = { foo: "bar" };
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
    
    fetchMock.useMockFetch(async (input, init) => {
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

    fetchMock.useMockFetch(async (input, init) => {
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
    fetchMock.useMockFetch(async () => {
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

  test("should parse JSON when content-type is provided even if not validated", async () => {
    fetchMock.useMockFetch(async () => {
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
    ).rejects.toThrow("Invalid JSON request body");
  });

  test("should not parse JSON when content-type is not validated in strict mode", async () => {
    fetchMock.useMockFetch(async () => {
      return new Response(JSON.stringify({ success: true }));
    });

    const bodySchema = z.object({ foo: z.string() });
    const headersSchema = z.object({
      "x-validated": z.string(),
    });

    const strictPrapti = new Prapti(zodAdapter, {
      headerValidationMode: "strict",
    });

    await expect(
      strictPrapti.fetch("https://api.example.com", {
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

    fetchMock.useMockFetch(async (input, init) => {
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

    fetchMock.useMockFetch(async (input, init) => {
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
    fetchMock.useMockFetch(async () => {
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

    fetchMock.useMockFetch(async (input, init) => {
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
      stringify: (value: unknown) => `custom:${JSON.stringify(value)}`,
      parse: (value: string) => JSON.parse(value.replace("custom:", "")),
      isJsonContentType: (contentType: string | null) =>
        contentType?.includes("application/json") ?? false,
    };

    const customPrapti = new Prapti(zodAdapter, { serializer });

    fetchMock.useMockFetch(async (input, init) => {
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

  test("should allow type-only usage for serialization and header mode", () => {
    const adapter: SerializationAdapter = {
      stringify: (value: unknown) => JSON.stringify(value),
      parse: (value: string) => JSON.parse(value),
      isJsonContentType: (contentType: string | null) => contentType === "application/json",
    };

    const config: PraptiConfig = {
      serializer: adapter,
      headerValidationMode: "preserve",
    };

    const headerMode: HeaderValidationMode = "strict";

    expect(config.headerValidationMode).toBe("preserve");
    expect(headerMode).toBe("strict");

    expect(adapter.parse(adapter.stringify({ ok: true }))).toEqual({ ok: true });
  });
});
