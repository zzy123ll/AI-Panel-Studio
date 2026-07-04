import { buildGeneratePanelPrompt } from "../prompts/generatePanel.js";
import { buildDecideActionPrompt } from "../prompts/decideAction.js";
import { buildExtractConsensusPrompt } from "../prompts/extractConsensus.js";
import { sleep } from "./sleep.js";

/* ── Constants ─────────────────────────────────────── */

const BASE_URL = "https://api.deepseek.com/v1/chat/completions";
const MODEL = "deepseek-chat";
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30_000;

/* ── Types ─────────────────────────────────────────── */

export interface PanelMember {
  name: string;
  title: string;
  stance: string;
}

export interface GeneratePanelResult {
  panel: PanelMember[];
}

export interface DecideActionResult {
  intent: "SPEAK" | "ASK" | "SUMMARIZE" | "END";
  content: string;
}

export interface DivergenceEntry {
  topic: string;
  positions: string[];
}

export interface ExtractConsensusResult {
  consensus: string[];
  divergences: DivergenceEntry[];
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>;
}

/* ── Helpers ───────────────────────────────────────── */

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    throw new Error("DEEPSEEK_API_KEY is not set in environment variables");
  }
  return key;
}

async function chatCompletion(
  messages: [ChatMessage, ChatMessage],
): Promise<string> {
  const apiKey = getApiKey();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          `Deepseek API error ${response.status}: ${JSON.stringify(body)}`,
        );
      }

      const data = (await response.json()) as ChatCompletionResponse;
      return data.choices[0]?.message?.content ?? "";
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      const error =
        err instanceof Error ? err : new Error(String(err));

      // Do not retry on abort (timeout)
      if (error.name === "AbortError") {
        throw new Error("Request timed out after 30 seconds");
      }

      lastError = error;

      // Last attempt — give up
      if (attempt === MAX_RETRIES) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s
      await sleep(2 ** attempt * 1000);
    }
  }

  throw lastError ?? new Error("Unknown error during chat completion");
}

function parseJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(
      `Failed to parse ${label} response as JSON. Raw: ${raw.slice(0, 200)}`,
    );
  }
}

/* ── Public API ────────────────────────────────────── */

/**
 * Generate a guest panel for the given discussion topic.
 * Retries up to 3 times with exponential backoff; 30s timeout per attempt.
 */
export async function generatePanel(
  topic: string,
  count: number,
): Promise<GeneratePanelResult> {
  const prompts = buildGeneratePanelPrompt(topic, count);
  const raw = await chatCompletion([
    { role: "system", content: prompts.system },
    { role: "user", content: prompts.user },
  ]);
  return parseJson<GeneratePanelResult>(raw, "generatePanel");
}

/**
 * Decide the moderator's next action based on discussion context & history.
 * Retries up to 3 times with exponential backoff; 30s timeout per attempt.
 */
export async function decideAction(
  context: Record<string, unknown>,
  history: string,
): Promise<DecideActionResult> {
  const prompts = buildDecideActionPrompt(context, history);
  const raw = await chatCompletion([
    { role: "system", content: prompts.system },
    { role: "user", content: prompts.user },
  ]);
  return parseJson<DecideActionResult>(raw, "decideAction");
}

/**
 * Extract consensus points and divergences from a recent transcript.
 * Retries up to 3 times with exponential backoff; 30s timeout per attempt.
 */
export async function extractConsensus(
  recentTranscript: string,
): Promise<ExtractConsensusResult> {
  const prompts = buildExtractConsensusPrompt(recentTranscript);
  const raw = await chatCompletion([
    { role: "system", content: prompts.system },
    { role: "user", content: prompts.user },
  ]);
  return parseJson<ExtractConsensusResult>(raw, "extractConsensus");
}
