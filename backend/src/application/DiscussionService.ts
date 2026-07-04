import { prisma } from "../services/prismaClient.js";
import type { Discussion, Participant, TranscriptEntry } from "@prisma/client";

/**
 * CRUD operations + state machine transitions for Discussion aggregate root.
 *
 * State flow: DRAFT → CONFIRMED → ONGOING → ENDED
 */
export class DiscussionService {
  /* ── Queries ─────────────────────────────────────── */

  async list(): Promise<Discussion[]> {
    return prisma.discussion.findMany({
      include: { participants: true },
      orderBy: { created_at: "desc" },
    });
  }

  async findById(
    id: string,
  ): Promise<(Discussion & { participants: Participant[]; transcriptEntries: TranscriptEntry[] }) | null> {
    return prisma.discussion.findUnique({
      where: { id },
      include: { participants: true, transcriptEntries: true },
    });
  }

  /* ── Mutations ───────────────────────────────────── */

  async create(topic: string): Promise<Discussion> {
    return prisma.discussion.create({
      data: { topic: topic.trim(), status: "DRAFT" },
    });
  }

  /** Advance DRAFT → CONFIRMED */
  async confirm(id: string): Promise<Discussion> {
    await this.assertStatus(id, "DRAFT");
    return prisma.discussion.update({
      where: { id },
      data: { status: "CONFIRMED" },
    });
  }

  /** Advance CONFIRMED → ONGOING */
  async markOngoing(id: string): Promise<Discussion> {
    await this.assertStatus(id, "CONFIRMED");
    return prisma.discussion.update({
      where: { id },
      data: { status: "ONGOING" },
    });
  }

  /** Advance any non-terminal → ENDED */
  async end(id: string): Promise<Discussion> {
    const d = await prisma.discussion.findUniqueOrThrow({ where: { id } });
    if (d.status === "ENDED") {
      throw new Error("Discussion is already ended");
    }
    return prisma.discussion.update({
      where: { id },
      data: { status: "ENDED" },
    });
  }

  /* ── Participants ────────────────────────────────── */

  async addParticipants(
    discussionId: string,
    members: Array<{
      name: string;
      role: "HOST" | "EXPERT";
      title: string;
      stance: string;
      color: string;
    }>,
  ): Promise<Participant[]> {
    return Promise.all(
      members.map((m) =>
        prisma.participant.create({
          data: { discussion_id: discussionId, ...m },
        }),
      ),
    );
  }

  async getParticipants(discussionId: string): Promise<Participant[]> {
    return prisma.participant.findMany({
      where: { discussion_id: discussionId },
    });
  }

  /* ── Transcript ──────────────────────────────────── */

  async appendTranscript(
    discussionId: string,
    speakerId: string,
    content: string,
  ): Promise<TranscriptEntry> {
    return prisma.transcriptEntry.create({
      data: {
        discussion_id: discussionId,
        speaker_id: speakerId,
        content,
      },
    });
  }

  /* ── Helpers ─────────────────────────────────────── */

  private async assertStatus(
    id: string,
    expected: string,
  ): Promise<void> {
    const d = await prisma.discussion.findUniqueOrThrow({ where: { id } });
    if (d.status !== expected) {
      throw new Error(
        `Discussion must be in ${expected} status (current: ${d.status})`,
      );
    }
  }
}

export const discussionService = new DiscussionService();
