export type JsonParseResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string };

export function formatJson(value: Record<string, unknown> | null | undefined): string {
  return JSON.stringify(value ?? {}, null, 2);
}

export function parseJsonInput(raw: string): JsonParseResult {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
      return { ok: false, error: "Value must be a JSON object" };
    }

    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Invalid JSON syntax" };
  }
}
