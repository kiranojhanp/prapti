import { describe, test, expect } from "bun:test";
import { z } from "zod";
import * as v from "valibot";
import * as yup from "yup";
import { adapters } from "../src/index";

describe("Adapters", () => {
  test("zod adapter should work", () => {
    const schema = z.object({
      id: z.number(),
      name: z.string(),
    });

    const data = { id: 1, name: "Test" };
    const result = adapters.zod.parse(schema, data);
    expect(result).toEqual(data);
  });

  test("valibot adapter should work", () => {
    const schema = v.object({
      id: v.number(),
      name: v.string(),
    });

    const data = { id: 1, name: "Test" };
    const result = adapters.valibot.parse(schema, data);
    expect(result).toEqual(data);
  });

  test("yup adapter should work", () => {
    const schema = yup.object({
      id: yup.number().required(),
      name: yup.string().required(),
    });

    const data = { id: 1, name: "Test" };
    const result = adapters.yup.parse(schema, data);
    expect(result).toEqual(data);
  });
});
