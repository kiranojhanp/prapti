import { describe, expect, test } from "bun:test";
import { ValidatedResponse } from "../src/index";
import { zodAdapter } from "../src/adapters/zod";
import { z } from "zod";

describe("ValidatedResponse Fixes", () => {
  // Test case for caching validated headers
  test("validatedHeaders should cache the result", () => {
    let parseCount = 0;
    const trackingAdapter = {
      parse: (schema: any, data: unknown) => {
        parseCount++;
        return schema.parse(data);
      },
    };

    const headers = new Headers({ "x-custom": "value" });
    const response = new Response(null, { headers });
    const schema = z.object({ "x-custom": z.string() });

    const validatedResponse = new ValidatedResponse(
      response,
      trackingAdapter,
      undefined,
      schema
    );

    // First access - should parse
    validatedResponse.validatedHeaders;
    expect(parseCount).toBe(1);

    // Second access - should use cached result
    validatedResponse.validatedHeaders;
    expect(parseCount).toBe(1); // Fails currently -> count increases every call
  });

  // Test case for formData with primitive return from schema
  test("formData should return new FormData even if schema returns non-object (safe handling)", async () => {
    const formData = new FormData();
    formData.append("foo", "bar");
    const response = new Response(formData);
    
    // Schema that transforms object to a string "not-an-object"
    const schema = z.object({ foo: z.string() }).transform(() => "not-an-object");
    
    const validatedResponse = new ValidatedResponse(
      response,
      zodAdapter,
      schema // responseSchema
    );

    // Should NOT return original unvalidated data
    // Should ideally throw because "not-an-object" can't be FormData
    expect(validatedResponse.formData()).rejects.toThrow(); // Fails currently -> returns promise resolving to original formData
  });

  // Test case for safe casting in formData/urlSearchParams
  test("formData construction should handle non-string/non-blob values safely", async () => {
    const formData = new FormData();
    formData.append("age", "123");
    const response = new Response(formData);
    
    // Schema that transforms string to number 123
    const schema = z.object({ age: z.string().transform(Number) });
    
    const validatedResponse = new ValidatedResponse(
      response,
      zodAdapter,
      schema
    );

    const result = await validatedResponse.formData();
    // It should convert number 123 back to string "123" when creating FormData
    expect(result.get("age")).toBe("123");
  });

  test("json should use provided serializer.parse", async () => {
    let parseCount = 0;
    const serializer = {
      stringify: (value: unknown) => JSON.stringify(value),
      parse: (value: string) => {
        parseCount++;
        return { parsed: value };
      },
    };

    const passthroughAdapter = {
      parse: (_schema: unknown, data: unknown) => data,
    };

    const response = new Response("not-json");
    const ValidatedResponseAny =
      ValidatedResponse as unknown as new (...args: any[]) => ValidatedResponse;
    const validatedResponse = new ValidatedResponseAny(
      response,
      passthroughAdapter,
      undefined,
      undefined,
      serializer
    );

    const result = await validatedResponse.json();

    expect(result).toEqual({ parsed: "not-json" });
    expect(parseCount).toBe(1);
  });

  test("rawHeaders should return lowercase-keyed object without schema", () => {
    const headers = new Headers({ "X-Custom": "Value", "Content-Type": "application/json" });
    const response = new Response(null, { headers });
    const validatedResponse = new ValidatedResponse(response, zodAdapter);

    const raw = validatedResponse.rawHeaders();
    expect(raw).toEqual({
      "x-custom": "Value",
      "content-type": "application/json",
    });
  });

  test("rawHeaders should return lowercase-keyed object even with schema", () => {
    const headers = new Headers({ "X-Custom": "Value" });
    const response = new Response(null, { headers });
    const schema = z.object({ "x-custom": z.string() });
    const validatedResponse = new ValidatedResponse(
      response,
      zodAdapter,
      undefined,
      schema
    );

    const raw = validatedResponse.rawHeaders();
    expect(raw).toEqual({ "x-custom": "Value" });
  });

  test("formData should stringify complex objects by default (native behavior)", async () => {
    const formData = new FormData();
    formData.append("profile", "ignored");
    const response = new Response(formData);

    const schema = z.object({
      profile: z.string().transform(() => ({ name: "Ada", meta: { age: 42 } })),
    });

    const validatedResponse = new ValidatedResponse(response, zodAdapter, schema);

    const result = await validatedResponse.formData();
    expect(result.get("profile")).toBe("[object Object]");
  });

  test("formData should throw in strict mode when schema returns complex objects (suggest serializer)", async () => {
    const formData = new FormData();
    formData.append("profile", "ignored");
    const response = new Response(formData);

    const schema = z.object({
      profile: z.string().transform(() => ({ name: "Ada", meta: { age: 42 } })),
    });

    const serializer = {
      stringify: (value: unknown) => JSON.stringify(value),
      parse: (value: string) => JSON.parse(value),
      formDataValueMode: "strict",
    } as any;

    const validatedResponse = new ValidatedResponse(
      response,
      zodAdapter,
      schema,
      undefined,
      serializer
    );

    await expect(validatedResponse.formData()).rejects.toThrow("superjson");
  });

  test("formData strict mode should throw on null/undefined values", async () => {
    const formData = new FormData();
    formData.append("value", "ignored");
    const response = new Response(formData);

    const schema = z.object({
      value: z.string().transform(() => null),
    });

    const serializer = {
      stringify: (value: unknown) => JSON.stringify(value),
      parse: (value: string) => JSON.parse(value),
      formDataValueMode: "strict",
    } as any;

    const validatedResponse = new ValidatedResponse(
      response,
      zodAdapter,
      schema,
      undefined,
      serializer
    );

    await expect(validatedResponse.formData()).rejects.toThrow("FormData");
  });
});
