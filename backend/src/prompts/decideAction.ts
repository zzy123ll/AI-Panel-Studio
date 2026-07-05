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

Decide what action this expert should take. Return a JSON object:
{
  "intent": "SPEAK" | "interject" | "rebut" | "WAIT",
  "content": "1-2 sentences in spoken Chinese, natural interruption or rebuttal. Keep it short — no long monologues."
}`,
  };
}
