# API Reference — AI Panel Studio

Base URL: `http://localhost:3001/api`

---

## Discussions

### `GET /discussions`

List all discussions, ordered by creation time (desc).

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "topic": "AI 对齐问题",
      "status": "DRAFT",
      "config": "{}",
      "created_at": "2026-07-04T07:12:42.344Z",
      "updated_at": "2026-07-04T07:12:42.344Z",
      "participants": []
    }
  ]
}
```

### `POST /discussions`

Create a new discussion.

**Body**: `{ "topic": "string" }`

**Response**: `201 Created` — Discussion object with `status: "DRAFT"`

### `GET /discussions/:id`

Get a discussion with participants and transcript entries.

### `POST /discussions/:id/generate`

Call the AI to generate a guest panel. Requires `DEEPSEEK_API_KEY`.

**Body** (optional): `{ "count": 4 }`

**Status flow**: `DRAFT → CONFIRMED`

**Response**: `{ "success": true, "data": { "participants": [...] } }`

### `POST /discussions/:id/start`

Initialize the discussion scheduler. Discussion must be in `CONFIRMED` status.

**Status flow**: `CONFIRMED → ONGOING`

---

## WebSocket Protocol

Connection: `ws://localhost:3001/studio`

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `JOIN` | `string (discussionId)` | Join discussion room |
| `CLIENT_CONFIRM` | `string (discussionId)` | Start scheduler |
| `CLIENT_STOP` | `string (discussionId)` | Stop scheduler |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `TRANSCRIPT_APPEND` | `{ discussionId, speakerId, speakerName, content, intent, timestamp }` | New speech |
| `CONSENSUS_NEW` | `{ discussionId, items: string[], isFinal?: boolean }` | Consensus extracted |
| `DIVERGENCE_NEW` | `{ discussionId, items: string[], isFinal?: boolean }` | Divergence identified |
| `AGENT_STATUS_CHANGE` | `{ discussionId, agents: [{ expertId, expertName, state, publicThought }] }` | Expert state change |
| `DISCUSSION_END` | `{ discussionId, topic, transcriptCount }` | Discussion ended |
| `HISTORY` | `{ discussionId, entries: [...] }` | Past transcript (on join) |
| `CONFIRMED` | `{ discussionId, running: true }` | Start acknowledged |
| `STOPPED` | `{ discussionId, running: false }` | Stop acknowledged |
| `ERROR` | `{ message: string }` | Error notification |

---

## Response Envelope

All HTTP responses use:
```json
{
  "success": true | false,
  "data": { ... },
  "error": "error message (on failure)"
}
```
