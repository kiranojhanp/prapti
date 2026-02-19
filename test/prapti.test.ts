import { describe, expect, test, mock, beforeAll, afterAll } from "bun:test";
import { Prapti, adapters } from "../src/index";
import { z } from "zod";

describe("Prapti Class Fixes", () => {
  const prapti = new Prapti(adapters.zod);
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

  test("should preserve headers that are not modified by requestHeadersSchema", async () => {
    let capturedHeaders: Headers | undefined;
    
    // @ts-ignore
    global.fetch = mock(async (input, init) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true }));
    });

    const headersSchema = z.object({
      "x-validated": z.string()
    });

    // In current implementation, if schema is provided, ONLY validated headers are used
    // We want to change this behavior to merge validated headers with original headers
    // Or strictly only include validated headers?
    // Given the requirement "lightweight wrapper", usually headers not in schema should probably stay
    // But schema validation implies strictness.
    // However, fetch automatically adds headers like Content-Length, User-Agent etc.
    // The issue identified was "header loss". If I pass "x-preserved" and it's not in schema,
    // usually Zod strips unknown keys by default.
    // If we want to preserve them, we need to merge.
    
    await prapti.fetch("https://api.example.com", {
      headers: {
        "x-validated": "valid",
        "x-preserved": "preserved"
      },
      requestHeadersSchema: headersSchema
    });

    expect(capturedHeaders?.get("x-validated")).toBe("valid");
    // This expects the fix to preserve non-validated headers
    // If the design choice is "schema defines ALL headers", then this test is wrong.
    // But typically schemas validate specific headers (like Auth), not ALL headers (like Trace-Id, etc).
    // So preserving unknown headers is safer for a wrapper.
    expect(capturedHeaders?.get("x-preserved")).toBe("preserved");
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
});
