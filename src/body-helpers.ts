export function formDataToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    if (result[key] !== undefined) {
      if (Array.isArray(result[key])) {
        (result[key] as unknown[]).push(value);
      } else {
        result[key] = [result[key], value];
      }
    } else {
      result[key] = value;
    }
  });
  return result;
}

export function urlSearchParamsToObject(
  params: URLSearchParams
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  params.forEach((value, key) => {
    if (result[key] !== undefined) {
      if (Array.isArray(result[key])) {
        (result[key] as unknown[]).push(value);
      } else {
        result[key] = [result[key], value];
      }
    } else {
      result[key] = value;
    }
  });
  return result;
}

export function objectToFormData(
  obj: Record<string, unknown>,
  mode: "native" | "strict" = "native"
): FormData {
  const formData = new FormData();
  Object.entries(obj).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        appendFormDataValue(formData, key, item, mode);
      });
    } else {
      appendFormDataValue(formData, key, value, mode);
    }
  });
  return formData;
}

export function objectToUrlSearchParams(
  obj: Record<string, unknown>
): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(obj).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        params.append(key, String(item));
      });
    } else {
      params.append(key, String(value));
    }
  });
  return params;
}

function appendFormDataValue(
  formData: FormData,
  key: string,
  value: unknown,
  mode: "native" | "strict"
) {
  if (value instanceof Blob) {
    formData.append(key, value);
    return;
  }

  if (mode === "native") {
    formData.append(key, String(value));
    return;
  }

  if (isAllowedFormDataScalar(value)) {
    formData.append(key, String(value));
    return;
  }

  if (value === undefined || value === null) {
    throw new Error(
      `FormData value for "${key}" is ${String(value)}. Consider serializing (e.g. superjson) before validation.`
    );
  }

  // Complex objects are not safely representable in FormData.
  throw new Error(
    `FormData value for "${key}" is a complex object. Consider serializing (e.g. superjson) before validation.`
  );
}

function isAllowedFormDataScalar(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}
