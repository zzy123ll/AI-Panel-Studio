/**
 * Prompt template for generating a guest panel.
 * @param topic  - Discussion topic
 * @param count  - Number of experts to generate (2–6)
 * @returns       System + user message pair for the LLM chat completion
 */
export function buildGeneratePanelPrompt(
  topic: string,
  count: number,
): { system: string; user: string } {
  return {
    system:
      "You are an expert discussion moderator. Output valid JSON only — no markdown, no preamble.",
    user: `Generate a panel of ${count} experts for a roundtable discussion on the topic: "${topic}".

For each expert, provide:
- name (string)
- title (string, their professional role)
- stance (string, 1-sentence summary of their position)

Return a JSON object: { "panel": [{ "name": "...", "title": "...", "stance": "..." }] }`,
  };
}
