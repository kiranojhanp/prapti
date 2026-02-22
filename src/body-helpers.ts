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

export function objectToFormData(obj: Record<string, unknown>): FormData {
  const formData = new FormData();
  Object.entries(obj).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        appendFormDataValue(formData, key, item);
      });
    } else {
      appendFormDataValue(formData, key, value);
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
  value: unknown
) {
  if (value instanceof Blob) {
    formData.append(key, value);
  } else {
    formData.append(key, String(value));
  }
}
