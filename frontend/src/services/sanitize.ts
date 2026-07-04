/**
 * Strip raw JSON artefacts from AI-generated text.
 *
 * The AI is instructed to return "valid JSON only — no markdown, no preamble".
 * If it ever emits the JSON wrapper (curly braces / square brackets) as part
 * of the content string, we strip them before rendering to the user.
 *
 * This is a defence-in-depth measure — the server SHOULD parse JSON first,
 * but the UI must never leak it to the user.
 */

/** Characters that indicate the string might be a raw JSON payload */
const JSON_WRAP_RE = /^[\[\{].*[\}\]]$/s;

/**
 * Return a display-safe version of `raw`.
 * - If `raw` is valid JSON, parse and extract the first meaningful string.
 * - If `raw` starts/ends with JSON brackets, try to extract the text inside.
 * - Otherwise return `raw` unchanged.
 */
export function sanitizeAiText(raw: string): string {
  if (!raw) return "";

  const trimmed = raw.trim();

  /* Case 1: it's a valid JSON object/array — pull out meaningful text */
  if (JSON_WRAP_RE.test(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;

      if (typeof parsed === "string") return parsed;

      if (Array.isArray(parsed)) {
        // Flatten array of strings
        const texts = parsed
          .filter(
            (item): item is string => typeof item === "string",
          )
          .join("；");
        if (texts) return texts;
      }

      if (typeof parsed === "object" && parsed !== null) {
        // Prefer common keys in AI output
        const obj = parsed as Record<string, unknown>;
        for (const key of [
          "content",
          "summary",
          "consensus",
          "text",
          "message",
          "result",
        ]) {
          if (typeof obj[key] === "string" && obj[key]) {
            return obj[key] as string;
          }
        }
        // Fallback: join all string values
        const parts = Object.values(obj)
          .filter((v): v is string => typeof v === "string")
          .join("；");
        if (parts) return parts;
      }
    } catch {
      /* Not valid JSON — fall through to heuristic */
    }
  }

  /* Case 2: heuristic — strip leading/trailing brackets */
  let result = trimmed;
  if (result.startsWith("{") && result.endsWith("}")) {
    result = result.slice(1, -1).trim();
    // Remove quotes around keys/values left from JSON
    result = result.replace(/^"|"$/g, "");
  }
  if (result.startsWith("[") && result.endsWith("]")) {
    result = result.slice(1, -1).trim();
    result = result.replace(/^"|"$/g, "");
  }

  return result || trimmed;
}

/**
 * Fast check: does the text contain raw JSON artefacts?
 * Used in E2E tests to detect rendering bugs.
 */
export function looksLikeRawJson(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  // If it starts with { or [ and contains ":" (JSON colon), likely raw JSON
  return /^[\[\{]/.test(t) && /[:\"]/.test(t) && /[\[\]\{\}]/.test(t.slice(-1));
}
