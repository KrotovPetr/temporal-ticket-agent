export function getByPath(input: unknown, path: string): unknown {
  if (path === "$") {
    return input;
  }

  if (!path.startsWith("$.")) {
    return path;
  }

  const parts = path.slice(2).split(".");
  let current: unknown = input;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export function getStringByPath(
  input: unknown,
  path: string,
  fallback = "",
): string {
  const value = getByPath(input, path);

  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return fallback;
}

export function getStringArrayByPath(input: unknown, path: string): string[] {
  const value = getByPath(input, path);

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (
        typeof item === "object" &&
        item !== null &&
        "name" in item &&
        typeof (item as { name: unknown }).name === "string"
      ) {
        return (item as { name: string }).name;
      }

      if (
        typeof item === "object" &&
        item !== null &&
        "display" in item &&
        typeof (item as { display: unknown }).display === "string"
      ) {
        return (item as { display: string }).display;
      }

      return undefined;
    })
    .filter((item): item is string => Boolean(item));
}
