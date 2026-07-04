import type { ExpertState } from "./Scheduler.js";

/**
 * Standalone per-expert state machine.
 *
 * States: idle → preparing → raising_hand → speaking → idle
 *
 * Each expert instance tracks:
 * - current state
 * - personal stance
 * - whether they are the host
 * - public thinking summary (non-hidden "CoT")
 */
export class AgentBrain {
  readonly expertId: string;
  readonly expertName: string;
  readonly stance: string;
  readonly isHost: boolean;

  private _state: ExpertState = "idle";
  private _publicThought: string = "";
  private _consecutiveSpeakCount: number = 0;

  constructor(opts: {
    expertId: string;
    expertName: string;
    stance: string;
    isHost: boolean;
  }) {
    this.expertId = opts.expertId;
    this.expertName = opts.expertName;
    this.stance = opts.stance;
    this.isHost = opts.isHost;
  }

  /* ── Properties ──────────────────────────────────── */

  get state(): ExpertState {
    return this._state;
  }

  get publicThought(): string {
    return this._publicThought;
  }

  get consecutiveSpeakCount(): number {
    return this._consecutiveSpeakCount;
  }

  /* ── State transitions ────────────────────────────── */

  /** Mark as selected for this tick — AI will decide intent */
  prepare(): void {
    if (this._state !== "idle") return;
    this._state = "preparing";
  }

  /** Expert decided to raise hand (AI returned interject/rebut) */
  raiseHand(thought: string): void {
    this._state = "raising_hand";
    this._publicThought = thought;
  }

  /** Won conflict resolution — now speaking */
  speak(): void {
    this._state = "speaking";
    this._consecutiveSpeakCount++;
  }

  /** Turn finished or lost conflict — back to idle */
  idle(): void {
    this._state = "idle";
    this._publicThought = "";
  }

  /** Reset consecutive count (someone else spoke) */
  resetConsecutiveCount(): void {
    this._consecutiveSpeakCount = 0;
  }

  /* ── Query ────────────────────────────────────────── */

  get isAvailable(): boolean {
    return this._state === "idle";
  }
}
