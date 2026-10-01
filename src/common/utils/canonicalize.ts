export function canonicalize(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => sortJson(item));
  }

  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => (left < right ? -1 : left > right ? 1 : 0),
    );

    for (const [key, nested] of entries) {
      sorted[key] = sortJson(nested);
    }

    return sorted;
  }
  
  return value;
}
