import { generatePanel } from "../infrastructure/aiClient.js";

const EXPERT_COLORS = [
  "#4dc9f6", "#f06292", "#81c784", "#ffb74d",
  "#ba68c8", "#4db6ac",
];

/**
 * Generates a host + expert panel for a discussion topic via the AI.
 * Persistence is delegated to DiscussionService.addParticipants.
 */
export class PanelGenerationService {
  /**
   * Call the AI to generate a panel, then shape the result into
   * Participant-ready records.
   * @returns structured member list ready for DB insertion
   */
  async generate(
    topic: string,
    count: number,
    options?: { skipHost?: boolean },
  ): Promise<
    Array<{
      name: string;
      role: "HOST" | "EXPERT";
      title: string;
      stance: string;
      color: string;
    }>
  > {
    const result = await generatePanel(topic, count);

    const skipHost = options?.skipHost ?? false;

    return result.panel.map((member, index) => ({
      name: member.name,
      role: skipHost ? "EXPERT" : (index === 0 ? "HOST" : "EXPERT"),
      title: member.title,
      stance: member.stance,
      color: EXPERT_COLORS[index % EXPERT_COLORS.length],
    }));
  }
}

export const panelGenerationService = new PanelGenerationService();
