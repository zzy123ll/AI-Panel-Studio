/**
 * Prompt template for extracting consensus and divergence from a transcript.
 * @param recentTranscript - Recent transcript text to analyze
 * @returns                  System + user message pair for the LLM chat completion
 */
export function buildExtractConsensusPrompt(
  recentTranscript: string,
): { system: string; user: string } {
  return {
    system:
      "You are a discussion analyst. Extract consensus points and divergences. Output valid JSON only — no markdown, no preamble.",
    user: `Analyze the following discussion transcript and extract:

1. Points that participants AGREE on (consensus)
2. Points where participants DISAGREE (divergences)

Transcript:
${recentTranscript}

Return a JSON object:
{
  "consensus": ["point 1", "point 2", ...],
  "divergences": [
    { "topic": "disagreement topic", "positions": ["side A", "side B"] }
  ]
}`,
  };
}
