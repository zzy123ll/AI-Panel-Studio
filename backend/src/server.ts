import "dotenv/config";
import express, { type Express } from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import { discussionService } from "./application/DiscussionService.js";
import { panelGenerationService } from "./application/PanelGenerationService.js";
import { summaryService } from "./application/SummaryService.js";
import { Scheduler } from "./agents/Scheduler.js";
import { WS_EVENT } from "./contracts/events.js";
import type { NewMessagePayload, Expert } from "./agents/Scheduler.js";

/* ── Constants ──────────────────────────────────────── */

const PORT = Number(process.env.PORT) || 3001;

/* ── Express + HTTP + Socket.io ──────────────────────── */

const app: Express = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

/* ── Root health-check ───────────────────────────────── */

app.get("/", (_req, res) => {
  res.json({
    name: "AI Panel Studio API",
    version: "1.0.0",
    status: "running",
    docs: "/api",
    websocket: "ws://localhost:" + PORT + "/studio",
  });
});

/* ── Discussion Session Store ───────────────────────── */

interface DiscussionSession {
  scheduler: Scheduler;
  discussionId: string;
}

const sessions = new Map<string, DiscussionSession>();

/* ── Helpers ─────────────────────────────────────────── */

function mapParticipantsToExperts(
  participants: Array<{
    id: string;
    name: string;
    role: string;
    stance: string;
  }>,
): Expert[] {
  return participants.map((p) => ({
    id: p.id,
    name: p.name,
    stance: p.stance,
    isHost: p.role === "HOST",
  }));
}

function wireSchedulerEvents(
  scheduler: Scheduler,
  discussionId: string,
): void {
  /* Transcript append */
  scheduler.on(
    WS_EVENT.TRANSCRIPT_APPEND,
    async (msg: NewMessagePayload) => {
      discussionService
        .appendTranscript(discussionId, msg.expertId, msg.content)
        .catch((err) =>
          console.error(
            `[scheduler] persist error disc=${discussionId}:`,
            (err as Error).message,
          ),
        );

      io.of("/studio").to(discussionId).emit(WS_EVENT.TRANSCRIPT_APPEND, {
        discussionId,
        speakerId: msg.expertId,
        speakerName: msg.expertName,
        content: msg.content,
        intent: msg.intent,
        timestamp: msg.timestamp,
      });
    },
  );

  /* Agent status change */
  scheduler.on(
    WS_EVENT.AGENT_STATUS_CHANGE,
    (payloads: Array<{
      expertId: string;
      expertName: string;
      state: string;
      publicThought: string;
    }>) => {
      io.of("/studio")
        .to(discussionId)
        .emit(WS_EVENT.AGENT_STATUS_CHANGE, {
          discussionId,
          agents: payloads,
        });
    },
  );

  /* Consensus new */
  scheduler.on(
    WS_EVENT.CONSENSUS_NEW,
    (payload: { items: string[] }) => {
      io.of("/studio").to(discussionId).emit(WS_EVENT.CONSENSUS_NEW, {
        discussionId,
        items: payload.items,
      });
    },
  );

  /* Divergence new */
  scheduler.on(
    WS_EVENT.DIVERGENCE_NEW,
    (payload: { items: string[] }) => {
      io.of("/studio")
        .to(discussionId)
        .emit(WS_EVENT.DIVERGENCE_NEW, {
          discussionId,
          items: payload.items,
        });
    },
  );

  /* Discussion end */
  scheduler.on(WS_EVENT.DISCUSSION_END, async (payload: { topic: string; transcriptCount: number }) => {
    /* Persist ENDED status before notifying clients */
    try {
      await discussionService.end(discussionId);
    } catch (err) {
      console.error(
        `[scheduler] end persist error disc=${discussionId}:`,
        (err as Error).message,
      );
    }

    io.of("/studio").to(discussionId).emit(WS_EVENT.DISCUSSION_END, {
      discussionId,
      ...payload,
    });

    /* Produce AI summary on end */
    const lines = scheduler
      .getTranscript()
      .map((t) => `[${t.speaker}]: ${t.content}`)
      .join("\n");

    summaryService
      .generate(lines)
      .then((summary) => {
        /* Emit final consensus & divergence to the live boards */
        io.of("/studio")
          .to(discussionId)
          .emit(WS_EVENT.CONSENSUS_NEW, {
            discussionId,
            items: summary.consensus,
            isFinal: true,
          });
        io.of("/studio")
          .to(discussionId)
          .emit(WS_EVENT.DIVERGENCE_NEW, {
            discussionId,
            items: summary.divergences.map(
              (d) =>
                `${(d as { topic: string }).topic}: ${((d as { positions: string[] }).positions ?? []).join(" vs ")}`,
            ),
            isFinal: true,
          });

        /* Emit unified summary for the summary bar */
        io.of("/studio")
          .to(discussionId)
          .emit(WS_EVENT.SUMMARY, {
            discussionId,
            summaryText: summary.summaryText,
            consensus: summary.consensus,
            divergences: summary.divergences,
          });
      })
      .catch((err) =>
        console.error(
          `[scheduler] summary error disc=${discussionId}:`,
          (err as Error).message,
        ),
      );
  });
}

/* ───────────────────────────────────────────────────────
   HTTP API — Discussion Lifecycle
   ─────────────────────────────────────────────────────── */

/**
 * GET /api/discussions
 */
app.get("/api/discussions", async (_req, res) => {
  const discussions = await discussionService.list();
  res.json({ success: true, data: discussions });
});

/**
 * GET /api/discussions/:id
 */
app.get("/api/discussions/:id", async (req, res) => {
  const { id } = req.params as { id: string };
  const discussion = await discussionService.findById(id);
  if (!discussion) {
    res.status(404).json({ success: false, error: "Discussion not found" });
    return;
  }
  res.json({ success: true, data: discussion });
});

/**
 * POST /api/discussions
 * Create a new discussion with DRAFT status.
 */
app.post("/api/discussions", async (req, res) => {
  const { topic } = req.body as { topic?: string };
  if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
    res.status(400).json({ success: false, error: "topic is required" });
    return;
  }

  const discussion = await discussionService.create(topic);
  console.log(`[api] created discussion ${discussion.id}: ${discussion.topic}`);
  res.status(201).json({ success: true, data: discussion });
});

/**
 * POST /api/discussions/:id/generate
 * Call the AI to generate a guest panel and persist to DB.
 */
app.post("/api/discussions/:id/generate", async (req, res) => {
  const { id } = req.params as { id: string };
  const { count = 4 } = (req.body as { count?: number }) ?? {};

  const discussion = await discussionService.findById(id);
  if (!discussion) {
    res.status(404).json({ success: false, error: "Discussion not found" });
    return;
  }
  if (discussion.status !== "DRAFT") {
    res.status(400).json({
      success: false,
      error: `Discussion must be in DRAFT status (current: ${discussion.status})`,
    });
    return;
  }

  let members;
  try {
    members = await panelGenerationService.generate(discussion.topic, count);
  } catch (err) {
    console.error("[api] generatePanel failed:", (err as Error).message);
    res.status(500).json({
      success: false,
      error: `AI generation failed: ${(err as Error).message}`,
    });
    return;
  }

  const participants = await discussionService.addParticipants(id, members);
  await discussionService.confirm(id);

  console.log(
    `[api] panel generated for ${id}: ${participants.length} participants`,
  );
  res.json({ success: true, data: { participants } });
});

/**
 * POST /api/discussions/:id/start
 * Initialise a Scheduler instance. Does NOT start ticking until
 * the client sends CLIENT_CONFIRM via WebSocket.
 */
app.post("/api/discussions/:id/start", async (req, res) => {
  const { id } = req.params as { id: string };

  const discussion = await discussionService.findById(id);
  if (!discussion) {
    res.status(404).json({ success: false, error: "Discussion not found" });
    return;
  }
  if (discussion.status !== "CONFIRMED") {
    res.status(400).json({
      success: false,
      error: `Discussion must be in CONFIRMED status (current: ${discussion.status})`,
    });
    return;
  }
  if (sessions.has(id)) {
    res.status(409).json({
      success: false,
      error: "Scheduler already initialised for this discussion",
    });
    return;
  }

  const experts = mapParticipantsToExperts(discussion.participants);
  const scheduler = new Scheduler({
    topic: discussion.topic,
    experts,
    tickIntervalMs: 4000,
    consensusInterval: 5,
    maxMessages: 12,  // auto-end after 12 messages (~3 consensus rounds)
  });

  wireSchedulerEvents(scheduler, id);
  sessions.set(id, { scheduler, discussionId: id });
  await discussionService.markOngoing(id);

  console.log(
    `[api] scheduler initialised for discussion ${id} (${experts.length} experts)`,
  );
  res.json({
    success: true,
    data: { status: "ONGOING", participantCount: experts.length },
  });
});

/* ───────────────────────────────────────────────────────
   WebSocket — /studio namespace
   ─────────────────────────────────────────────────────── */

const studioNs = io.of("/studio");

studioNs.on("connection", (socket) => {
  console.log(`[ws] client connected: ${socket.id}`);

  /* Join a discussion room */
  socket.on(WS_EVENT.JOIN, (discussionId: string) => {
    if (!discussionId || typeof discussionId !== "string") return;

    socket.join(discussionId);
    console.log(`[ws] ${socket.id} joined room ${discussionId}`);

    /* Send existing transcript history */
    discussionService
      .findById(discussionId)
      .then((discussion) => {
        if (discussion) {
          socket.emit(WS_EVENT.HISTORY, {
            discussionId,
            entries: discussion.transcriptEntries.map((e: { id: string; speaker_id: string; content: string; timestamp: Date }) => ({
              id: e.id,
              speakerId: e.speaker_id,
              content: e.content,
              timestamp: e.timestamp,
            })),
          });
        }
      })
      .catch((err) =>
        console.error(
          `[ws] history load error disc=${discussionId}:`,
          (err as Error).message,
        ),
      );
  });

  /* Client confirms ready — start the Scheduler */
  socket.on(WS_EVENT.CLIENT_CONFIRM, (discussionId: string) => {
    if (!discussionId || typeof discussionId !== "string") return;

    const session = sessions.get(discussionId);
    if (!session) {
      socket.emit(WS_EVENT.ERROR, {
        message: `No session found for discussion ${discussionId}.`,
      });
      return;
    }
    if (session.scheduler.isRunning()) {
      socket.emit(WS_EVENT.ERROR, {
        message: "Scheduler is already running for this discussion.",
      });
      return;
    }

    session.scheduler.start();
    console.log(`[ws] scheduler started for discussion ${discussionId}`);
    socket.emit(WS_EVENT.CONFIRMED, { discussionId, running: true });
  });

  /* Client requests stop */
  socket.on(WS_EVENT.CLIENT_STOP, (discussionId: string) => {
    const session = sessions.get(discussionId);
    if (session && session.scheduler.isRunning()) {
      session.scheduler.stop();
      console.log(`[ws] scheduler stopped for discussion ${discussionId}`);
      socket.emit(WS_EVENT.STOPPED, { discussionId, running: false });
    }
  });

  /* Client leaves a discussion room */
  socket.on(WS_EVENT.LEAVE, (discussionId: string) => {
    if (!discussionId || typeof discussionId !== "string") return;
    socket.leave(discussionId);
    console.log(`[ws] ${socket.id} left room ${discussionId}`);
  });

  socket.on("disconnect", () => {
    console.log(`[ws] client disconnected: ${socket.id}`);
  });
});

/* ── Start ────────────────────────────────────────────── */

httpServer.listen(PORT, () => {
  console.log(
    `\n🚀 AI Panel Studio server running on http://localhost:${PORT}`,
  );
  console.log(`   WebSocket: ws://localhost:${PORT}/studio\n`);
});

export { app, httpServer, sessions };
