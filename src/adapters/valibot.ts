// Import the generic ValidationAdapter type (assuming it's exported from index)
// We need to avoid circular dependency if ValidationAdapter is in index.ts
// So we might need to move types to a separate file later or just use 'any' for now internally
// and fix types in index.ts.

// For now, let's make it work.
// The user will import `createValibotAdapter` and pass their `valibot` instance.

export const createValibotAdapter = (valibot: any) => {
  return {
    parse: (schema: any, data: unknown) => {
      return valibot.parse(schema, data);
    },
  };
};
