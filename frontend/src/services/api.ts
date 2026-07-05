/* ── Backend API base ──────────────────────────────── */

const BASE = "http://localhost:3001/api";

/* ── Types ──────────────────────────────────────────── */

export interface DiscussionResponse {
  id: string;
  topic: string;
  status: "DRAFT" | "CONFIRMED" | "ONGOING" | "ENDED";
  config: string;
  created_at: string;
  updated_at: string;
  participants: ParticipantResponse[];
  transcriptEntries?: TranscriptEntryResponse[];
}

export interface ParticipantResponse {
  id: string;
  discussion_id: string;
  name: string;
  role: "HOST" | "EXPERT";
  title: string;
  stance: string;
  color: string;
}

export interface TranscriptEntryResponse {
  id: string;
  discussion_id: string;
  speaker_id: string;
  content: string;
  timestamp: string;
}

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/* ── HTTP helpers ───────────────────────────────────── */

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return (await res.json()) as ApiEnvelope<T>;
}

/* ── Public API ─────────────────────────────────────── */

export function listDiscussions() {
  return request<DiscussionResponse[]>("/discussions");
}

export function getDiscussion(id: string) {
  return request<DiscussionResponse>(`/discussions/${id}`);
}

export function createDiscussion(topic: string) {
  return request<DiscussionResponse>("/discussions", {
    method: "POST",
    body: JSON.stringify({ topic }),
  });
}

export function confirmDiscussion(id: string) {
  return request<DiscussionResponse>(`/discussions/${id}/confirm`, {
    method: "POST",
  });
}

export function generatePanel(id: string, count = 4) {
  return request<{ participants: ParticipantResponse[] }>(
    `/discussions/${id}/generate`,
    {
      method: "POST",
      body: JSON.stringify({ count }),
    },
  );
}

export function startDiscussion(id: string) {
  return request<{ status: string; participantCount: number }>(
    `/discussions/${id}/start`,
    { method: "POST" },
  );
}

export function removeParticipant(participantId: string) {
  return request<void>(`/participants/${participantId}`, {
    method: "DELETE",
  });
}
