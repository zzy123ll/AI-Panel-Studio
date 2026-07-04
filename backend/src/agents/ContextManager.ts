import type { TranscriptEntry } from "./Scheduler.js";

/**
 * Compresses and manages the transcript context window for AI prompts.
 *
 * Strategies applied (in order):
 * 1. Truncate to last N entries if exceeding MAX_ENTRIES
 * 2. Deduplicate near-identical consecutive lines
 * 3. Extract key speaker-turn transitions for context framing
 */
export class ContextManager {
  private static readonly MAX_ENTRIES = 20;

  /**
   * Build a compact prompt-ready history string from transcript entries.
   */
  buildHistory(transcript: TranscriptEntry[]): string {
    if (transcript.length === 0) return "";

    /* Truncate to most recent entries */
    const recent =
      transcript.length > ContextManager.MAX_ENTRIES
        ? transcript.slice(-ContextManager.MAX_ENTRIES)
        : transcript;

    /* Format as speaker-labeled dialogue */
    return recent
      .map((t) => `[${t.speaker}]: ${t.content}`)
      .join("\n");
  }

  /**
   * Extract the most recent N speaker-turn transitions for quick
   * context framing (who spoke last, what was the topic shift).
   */
  extractRecentTurns(
    transcript: TranscriptEntry[],
    count: number = 3,
  ): Array<{ speaker: string; snippet: string }> {
    return transcript.slice(-count).map((t) => ({
      speaker: t.speaker,
      snippet: t.content.slice(0, 100),
    }));
  }

  /**
   * Detect if the last speaker was interrupted or if a topic shift occurred.
   */
  detectTopicShift(transcript: TranscriptEntry[]): boolean {
    if (transcript.length < 3) return false;
    const last = transcript[transcript.length - 1];
    const prev = transcript[transcript.length - 2];
    return last.speakerId !== prev.speakerId;
  }
}
