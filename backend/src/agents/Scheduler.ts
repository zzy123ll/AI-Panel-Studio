import { EventEmitter } from "events";
import { decideAction } from "../infrastructure/aiClient.js";

/* ── Types ─────────────────────────────────────────── */

export type ExpertState = "idle" | "preparing" | "speaking";

export interface Expert {
  id: string;
  name: string;
  stance: string;
  isHost: boolean;
}

export interface ExpertStateEntry {
  expertId: string;
  expertName: string;
  stance: string;
  isHost: boolean;
  state: ExpertState;
}

export interface TranscriptEntry {
  id: string;
  speaker: string;
  speakerId: string;
  content: string;
  intent: string;
  timestamp: number;
}

export interface NewMessagePayload {
  expertId: string;
  expertName: string;
  content: string;
  intent: string;
  timestamp: number;
}

export interface SchedulerConfig {
  topic: string;
  experts: Expert[];
  tickIntervalMs?: number;
}

/* ── Scheduler ──────────────────────────────────────── */

export class Scheduler extends EventEmitter {
  readonly tickInterval: number;
  private readonly topic: string;
  private readonly experts: Map<string, ExpertStateEntry>;
  private readonly transcript: TranscriptEntry[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSpeakerId: string | null = null;
  private running = false;
  private messageCounter = 0;

  constructor(config: SchedulerConfig) {
    super();
    this.topic = config.topic;
    this.tickInterval = config.tickIntervalMs ?? 4000;
    this.experts = new Map();
    for (const expert of config.experts) {
      this.experts.set(expert.id, {
        expertId: expert.id,
        expertName: expert.name,
        stance: expert.stance,
        isHost: expert.isHost,
        state: "idle",
      });
    }
  }

  /* ── Public API ──────────────────────────────────── */

  getExpertStates(): ExpertStateEntry[] {
    return [...this.experts.values()];
  }

  getTranscript(): TranscriptEntry[] {
    return [...this.transcript];
  }

  isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => {
      this.tick().catch(() => {
        /* swallow per-tick errors to keep the interval alive */
      });
    }, this.tickInterval);
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Execute one scheduler tick:
   * 1. Pick 1-2 idle experts at random
   * 2. Call decideAction for each with transcript + topic context
   * 3. Resolve conflicts (host priority, then stance opposition)
   * 4. Emit 'newMessage' for the winner
   */
  async tick(): Promise<void> {
    const candidates = this.pickIdleExperts();
    if (candidates.length === 0) return;

    /* Mark selected experts as preparing */
    for (const c of candidates) {
      c.state = "preparing";
    }

    /* Ask each selected expert what they want to do */
    const results = await Promise.allSettled(
      candidates.map(async (entry) => {
        const history = this.formatTranscript();
        const context: Record<string, unknown> = {
          expertId: entry.expertId,
          expertName: entry.expertName,
          topic: this.topic,
          isHost: entry.isHost,
          stance: entry.stance,
        };
        const result = await decideAction(context, history);
        // Widen intent type — Scheduler accepts any intent the AI returns
        return { entry, result: result as { intent: string; content: string } };
      }),
    );

    /* Only keep experts who returned a speak-related intent */
    const speakers = results
      .filter(
        (
          r,
        ): r is PromiseFulfilledResult<{
          entry: ExpertStateEntry;
          result: { intent: string; content: string };
        }> =>
          r.status === "fulfilled" &&
          ["interject", "rebut", "SPEAK"].includes(
            r.value.result.intent,
          ),
      )
      .map((r) => r.value);

    if (speakers.length === 0) {
      /* Nobody wants to speak — return everyone to idle */
      for (const c of candidates) {
        c.state = "idle";
      }
      return;
    }

    /* Conflict resolution */
    const winner = this.resolveConflict(speakers);

    /* Mark winner as speaking */
    winner.entry.state = "speaking";

    const now = Date.now();
    const message: NewMessagePayload = {
      expertId: winner.entry.expertId,
      expertName: winner.entry.expertName,
      content: winner.result.content,
      intent: winner.result.intent,
      timestamp: now,
    };

    /* Record in transcript */
    this.transcript.push({
      id: `msg-${now}-${++this.messageCounter}`,
      speaker: winner.entry.expertName,
      speakerId: winner.entry.expertId,
      content: winner.result.content,
      intent: winner.result.intent,
      timestamp: now,
    });

    /* Emit event to consumers */
    this.emit("newMessage", message);

    /* Update last-speaker tracking */
    this.lastSpeakerId = winner.entry.expertId;

    /* Reset winner to idle */
    winner.entry.state = "idle";

    /* Reset losers to idle */
    for (const s of speakers) {
      if (s.entry.expertId !== winner.entry.expertId) {
        s.entry.state = "idle";
      }
    }
  }

  /* ── Private helpers ─────────────────────────────── */

  /**
   * Randomly select 1–2 idle experts, excluding the last speaker.
   */
  private pickIdleExperts(): ExpertStateEntry[] {
    const idle = [...this.experts.values()].filter(
      (e) => e.state === "idle" && e.expertId !== this.lastSpeakerId,
    );

    if (idle.length === 0) return [];

    /* Fisher-Yates shuffle */
    for (let i = idle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idle[i], idle[j]] = [idle[j], idle[i]];
    }

    /* Pick 1 or 2 */
    const count = Math.random() > 0.5 && idle.length >= 2 ? 2 : 1;
    return idle.slice(0, count);
  }

  /**
   * Resolve conflicts when multiple experts want to speak simultaneously:
   * 1. Host priority — if exactly one host, they win
   * 2. Stance opposition — pick the expert whose stance is most opposed
   *    to the last speaker. Ties break to the first candidate.
   */
  private resolveConflict(
    speakers: Array<{
      entry: ExpertStateEntry;
      result: { intent: string; content: string };
    }>,
  ): {
    entry: ExpertStateEntry;
    result: { intent: string; content: string };
  } {
    if (speakers.length === 1) return speakers[0];

    /* Host priority */
    const hosts = speakers.filter((s) => s.entry.isHost);
    if (hosts.length === 1) return hosts[0];

    /* Multiple hosts or no hosts — use stance opposition */
    const candidates = hosts.length > 1 ? hosts : speakers;

    const lastSpeaker = this.lastSpeakerId
      ? this.experts.get(this.lastSpeakerId)
      : null;
    const lastStance = lastSpeaker?.stance ?? "";

    const sorted = [...candidates].sort((a, b) => {
      const oppA = this.computeStanceOpposition(
        a.entry.stance,
        lastStance,
      );
      const oppB = this.computeStanceOpposition(
        b.entry.stance,
        lastStance,
      );
      return oppB - oppA; /* descending — highest opposition first */
    });

    return sorted[0];
  }

  /**
   * Compute how opposed two stances are.
   * Currently binary: 0 = same stance, 1 = different.
   * Future: could use semantic similarity / embedding distance.
   */
  private computeStanceOpposition(
    stance1: string,
    stance2: string,
  ): number {
    if (!stance2) return 0;
    if (stance1 === stance2) return 0;
    return 1;
  }

  /**
   * Format the current transcript as a readable history string
   * for the AI prompt context.
   */
  private formatTranscript(): string {
    if (this.transcript.length === 0) return "";
    return this.transcript
      .map((t) => `[${t.speaker}]: ${t.content}`)
      .join("\n");
  }
}
