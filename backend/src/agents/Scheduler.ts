import { EventEmitter } from "events";
import { decideAction, extractConsensus } from "../infrastructure/aiClient.js";
import { ContextManager } from "./ContextManager.js";
import { AgentBrain } from "./AgentBrain.js";
import { WS_EVENT } from "../contracts/events.js";

/* ── Types ─────────────────────────────────────────── */

export type ExpertState = "idle" | "preparing" | "raising_hand" | "speaking";

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
  publicThought: string;
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
  /** Emit consensus every N transcript entries (default 5) */
  consensusInterval?: number;
}

/* ── Scheduler ──────────────────────────────────────── */

export class Scheduler extends EventEmitter {
  readonly tickInterval: number;
  private readonly topic: string;
  private readonly agents: Map<string, AgentBrain>;
  private readonly transcript: TranscriptEntry[] = [];
  private readonly contextManager = new ContextManager();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSpeakerId: string | null = null;
  private running = false;
  private messageCounter = 0;
  private readonly consensusInterval: number;

  constructor(config: SchedulerConfig) {
    super();
    this.topic = config.topic;
    this.tickInterval = config.tickIntervalMs ?? 4000;
    this.consensusInterval = config.consensusInterval ?? 5;
    this.agents = new Map();
    for (const expert of config.experts) {
      const brain = new AgentBrain({
        expertId: expert.id,
        expertName: expert.name,
        stance: expert.stance,
        isHost: expert.isHost,
      });
      this.agents.set(expert.id, brain);
    }
  }

  /* ── Public API ──────────────────────────────────── */

  getExpertStates(): ExpertStateEntry[] {
    return [...this.agents.values()].map((a) => ({
      expertId: a.expertId,
      expertName: a.expertName,
      stance: a.stance,
      isHost: a.isHost,
      state: a.state,
      publicThought: a.publicThought,
    }));
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
    this.emit(WS_EVENT.DISCUSSION_END, {
      topic: this.topic,
      transcriptCount: this.transcript.length,
    });
  }

  /**
   * Execute one scheduler tick:
   * 1. Pick 1-2 idle agents at random
   * 2. Call decideAction for each with compressed context
   * 3. Resolve conflicts (host priority, then stance opposition)
   * 4. Emit TRANSCRIPT_APPEND + AGENT_STATUS_CHANGE
   * 5. Periodically trigger consensus extraction
   */
  async tick(): Promise<void> {
    const candidates = this.pickIdleAgents();
    if (candidates.length === 0) return;

    /* Mark selected agents as preparing */
    for (const agent of candidates) {
      agent.prepare();
    }
    this.broadcastAgentStatus(candidates);

    /* Ask each selected agent what they want to do */
    const history = this.contextManager.buildHistory(this.transcript);
    const results = await Promise.allSettled(
      candidates.map(async (agent) => {
        const context: Record<string, unknown> = {
          expertId: agent.expertId,
          expertName: agent.expertName,
          topic: this.topic,
          isHost: agent.isHost,
          stance: agent.stance,
        };
        const result = await decideAction(context, history);
        return { agent, result: result as { intent: string; content: string } };
      }),
    );

    /* Only keep agents who returned a speak-related intent */
    const speakers = results
      .filter(
        (
          r,
        ): r is PromiseFulfilledResult<{
          agent: AgentBrain;
          result: { intent: string; content: string };
        }> =>
          r.status === "fulfilled" &&
          ["interject", "rebut", "SPEAK"].includes(r.value.result.intent),
      )
      .map((r) => r.value);

    /* Mark speakers as raising_hand */
    for (const s of speakers) {
      s.agent.raiseHand(s.result.content.slice(0, 100));
    }

    if (speakers.length === 0) {
      /* Nobody wants to speak — return everyone to idle */
      for (const agent of candidates) {
        agent.idle();
      }
      this.broadcastAgentStatus(candidates);
      return;
    }

    /* Conflict resolution */
    const winner = this.resolveConflict(speakers);

    /* Winner speaks */
    winner.agent.speak();

    const now = Date.now();
    const message: NewMessagePayload = {
      expertId: winner.agent.expertId,
      expertName: winner.agent.expertName,
      content: winner.result.content,
      intent: winner.result.intent,
      timestamp: now,
    };

    /* Record in transcript */
    this.transcript.push({
      id: `msg-${now}-${++this.messageCounter}`,
      speaker: winner.agent.expertName,
      speakerId: winner.agent.expertId,
      content: winner.result.content,
      intent: winner.result.intent,
      timestamp: now,
    });

    /* Emit standardized events */
    this.emit(WS_EVENT.TRANSCRIPT_APPEND, message);

    /* Update last-speaker tracking */
    this.lastSpeakerId = winner.agent.expertId;

    /* Reset all agents to idle, clear consecutive counts for non-winners */
    for (const agent of this.agents.values()) {
      if (agent.expertId !== winner.agent.expertId) {
        agent.resetConsecutiveCount();
      }
    }
    for (const s of speakers) {
      s.agent.idle();
    }
    for (const agent of candidates) {
      if (agent.state !== "idle") agent.idle();
    }
    this.broadcastAgentStatus([...this.agents.values()]);

    /* Periodic consensus extraction (every N entries) */
    if (
      this.transcript.length > 0 &&
      this.transcript.length % this.consensusInterval === 0
    ) {
      this.extractAndBroadcastConsensus();
    }
  }

  /* ── Private helpers ─────────────────────────────── */

  private pickIdleAgents(): AgentBrain[] {
    const idle = [...this.agents.values()].filter(
      (a) =>
        a.isAvailable && a.expertId !== this.lastSpeakerId,
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

  private resolveConflict(
    speakers: Array<{
      agent: AgentBrain;
      result: { intent: string; content: string };
    }>,
  ): {
    agent: AgentBrain;
    result: { intent: string; content: string };
  } {
    if (speakers.length === 1) return speakers[0];

    /* Host priority */
    const hosts = speakers.filter((s) => s.agent.isHost);
    if (hosts.length === 1) return hosts[0];

    /* Multiple hosts or no hosts — use stance opposition */
    const candidates = hosts.length > 1 ? hosts : speakers;

    const lastSpeaker = this.lastSpeakerId
      ? this.agents.get(this.lastSpeakerId)
      : null;
    const lastStance = lastSpeaker?.stance ?? "";

    const sorted = [...candidates].sort((a, b) => {
      const oppA = this.computeStanceOpposition(
        a.agent.stance,
        lastStance,
      );
      const oppB = this.computeStanceOpposition(
        b.agent.stance,
        lastStance,
      );
      return oppB - oppA;
    });

    return sorted[0];
  }

  private computeStanceOpposition(
    stance1: string,
    stance2: string,
  ): number {
    if (!stance2) return 0;
    if (stance1 === stance2) return 0;
    return 1;
  }

  /**
   * Broadcast AGENT_STATUS_CHANGE for affected agents.
   */
  private broadcastAgentStatus(agents: AgentBrain[]): void {
    const payloads = agents.map((a) => ({
      expertId: a.expertId,
      expertName: a.expertName,
      state: a.state,
      publicThought: a.publicThought,
    }));
    this.emit(WS_EVENT.AGENT_STATUS_CHANGE, payloads);
  }

  /**
   * Asynchronously extract consensus/divergence and broadcast.
   * Fire-and-forget — failures are logged but don't block the tick.
   */
  private extractAndBroadcastConsensus(): void {
    const text = this.contextManager.buildHistory(this.transcript);
    if (!text) return;

    extractConsensus(text)
      .then((result) => {
        if (result.consensus.length > 0) {
          this.emit(WS_EVENT.CONSENSUS_NEW, {
            items: result.consensus.map((c) =>
              typeof c === "string" ? c : String(c),
            ),
          });
        }
        if (result.divergences.length > 0) {
          this.emit(WS_EVENT.DIVERGENCE_NEW, {
            items: result.divergences.map((d) =>
              typeof d === "string"
                ? d
                : `${(d as { topic: string }).topic}: ${((d as { positions: string[] }).positions ?? []).join(" vs ")}`,
            ),
          });
        }
      })
      .catch((err) => {
        console.error(
          "[Scheduler] consensus extraction failed:",
          (err as Error).message,
        );
      });
  }
}
