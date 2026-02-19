import { describe, test, expect } from "bun:test";
import { z } from "zod";
import * as v from "valibot";
import * as yup from "yup";
import { zodAdapter } from "../src/adapters/zod";
import { valibotAdapter } from "../src/adapters/valibot";
import { yupAdapter } from "../src/adapters/yup";

describe("Adapters", () => {
  test("zod adapter should work", () => {
    const schema = z.object({
      id: z.number(),
      name: z.string(),
    });

    const data = { id: 1, name: "Test" };
    const result = zodAdapter.parse(schema, data);
    expect(result).toEqual(data);
  });

  test("valibot adapter should work", () => {
    const schema = v.object({
      id: v.number(),
      name: v.string(),
    });

    const data = { id: 1, name: "Test" };
    const result = valibotAdapter.parse(schema, data);
    expect(result).toEqual(data);
  });

  test("yup adapter should work", () => {
    const schema = yup.object({
      id: yup.number().required(),
      name: yup.string().required(),
    });

    const data = { id: 1, name: "Test" };
    const result = yupAdapter.parse(schema, data);
    expect(result).toEqual(data);
  });
});
