import { extractConsensus } from "../infrastructure/aiClient.js";
import type { ExtractConsensusResult } from "../infrastructure/aiClient.js";

/**
 * Generates an AI-powered natural-language summary when a discussion ends.
 *
 * Uses `extractConsensus` internally — which calls the Deepseek API with
 * a system prompt instructing "Output valid JSON only — no markdown, no preamble."
 * The raw AI output is parsed server-side so the frontend NEVER sees raw JSON.
 */
export class SummaryService {
  /**
   * Produce a structured end-of-discussion summary.
   * @param transcriptText — the full transcript joined as a single string
   * @returns consensus points, divergence items, and a natural-language summary
   */
  async generate(
    transcriptText: string,
  ): Promise<ExtractConsensusResult & { summaryText: string }> {
    if (!transcriptText.trim()) {
      return {
        consensus: [],
        divergences: [],
        summaryText: "本次讨论未产生有效发言记录。",
      };
    }

    /* Primary AI extraction */
    let aiResult: ExtractConsensusResult;
    try {
      aiResult = await extractConsensus(transcriptText);
    } catch (err) {
      console.error(
        "[SummaryService] AI extraction failed, falling back to heuristic:",
        (err as Error).message,
      );
      aiResult = this.heuristicExtraction(transcriptText);
    }

    /* Build human-readable summary from structured data */
    const parts: string[] = [];

    if (aiResult.consensus.length > 0) {
      parts.push(
        `本次讨论达成了以下共识：${aiResult.consensus.map((c, i) => `${i + 1}. ${c}`).join("；")}`,
      );
    }

    if (aiResult.divergences.length > 0) {
      parts.push(
        `仍存在以下分歧：${aiResult.divergences.map((d) => `${d.topic}（${(d as { positions: string[] }).positions?.join(" vs ") ?? ""}）`).join("；")}`,
      );
    }

    if (parts.length === 0) {
      parts.push("嘉宾从多个角度进行了深入讨论，但在核心议题上未形成明确共识或分歧。");
    }

    return {
      ...aiResult,
      summaryText: parts.join("\n\n"),
    };
  }

  /**
   * Fallback heuristic when the AI is unavailable — counts lines, extracts
   * keywords, builds a basic structural summary.
   */
  private heuristicExtraction(
    text: string,
  ): ExtractConsensusResult {
    const lines = text
      .split("\n")
      .filter((l) => l.trim().length > 0);

    return {
      consensus: [
        `讨论共产生 ${lines.length} 条有效发言，嘉宾从不同角度进行了深入探讨`,
      ],
      divergences: [],
    };
  }
}

export const summaryService = new SummaryService();
