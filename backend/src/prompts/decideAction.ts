/**
 * Prompt template for the LLM to decide the next moderator action.
 * @param context - Current discussion metadata (status, round, etc.)
 * @param history - Recent transcript entries
 * @returns         System + user message pair for the LLM chat completion
 */
export function buildDecideActionPrompt(
  context: Record<string, unknown>,
  history: string,
): { system: string; user: string } {
  return {
    system:
      "You are a discussion moderator AI. Decide the next action. Output valid JSON only — no markdown, no preamble.",
    user: `Context: ${JSON.stringify(context)}

Recent transcript:
${history}

Decide what the moderator should do next. Return a JSON object:
{
  "intent": "SPEAK" | "ASK" | "SUMMARIZE" | "END",
  "content": "the exact text to say or ask"
}`,
  };
}
