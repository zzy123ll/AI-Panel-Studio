import express, { type Express } from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import { prisma } from "./services/prismaClient.js";
import { generatePanel } from "./infrastructure/aiClient.js";
import { Scheduler } from "./agents/Scheduler.js";
import type { NewMessagePayload, Expert } from "./agents/Scheduler.js";

/* ── Constants ──────────────────────────────────────── */

const PORT = Number(process.env.PORT) || 3001;

const EXPERT_COLORS = [
  "#4dc9f6", // expert-1  cyan
  "#f06292", // expert-2  pink
  "#81c784", // expert-3  green
  "#ffb74d", // expert-4  orange
  "#ba68c8", // expert-5  purple
  "#4db6ac", // expert-6  teal
];

/* ── Express + HTTP + Socket.io ──────────────────────── */

const app: Express = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

/* ── Discussion Session Store ───────────────────────── */

interface DiscussionSession {
  scheduler: Scheduler;
  discussionId: string;
}

/** Isolated per-discussion sessions. Key = discussion UUID. */
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

/**
 * Persist a Scheduler newMessage event to the TranscriptEntry table
 * and broadcast it to the discussion's Socket.io room.
 */
function wireSchedulerEvents(
  scheduler: Scheduler,
  discussionId: string,
): void {
  scheduler.on(
    "newMessage",
    async (msg: NewMessagePayload) => {
      /* Persist to SQLite (fire-and-forget — don't block the tick) */
      prisma.transcriptEntry
        .create({
          data: {
            discussion_id: discussionId,
            speaker_id: msg.expertId,
            content: msg.content,
          },
        })
        .catch((err) => {
          console.error(
            `[scheduler] failed to persist transcript for discussion ${discussionId}:`,
            (err as Error).message,
          );
        });

      /* Broadcast to the discussion room */
      io.of("/studio").to(discussionId).emit("transcript", {
        discussionId,
        speakerId: msg.expertId,
        speakerName: msg.expertName,
        content: msg.content,
        intent: msg.intent,
        timestamp: msg.timestamp,
      });
    },
  );
}

/* ───────────────────────────────────────────────────────
   HTTP API — Discussion Lifecycle
   ─────────────────────────────────────────────────────── */

/**
 * POST /api/discussions
 * Create a new discussion with DRAFT status.
 * Body: { topic: string }
 */
app.post("/api/discussions", async (req, res) => {
  const { topic } = req.body as { topic?: string };

  if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
    res.status(400).json({ success: false, error: "topic is required" });
    return;
  }

  const discussion = await prisma.discussion.create({
    data: { topic: topic.trim(), status: "DRAFT" },
  });

  console.log(`[api] created discussion ${discussion.id}: ${discussion.topic}`);
  res.status(201).json({ success: true, data: discussion });
});

/**
 * POST /api/discussions/:id/generate
 * Call the AI to generate a guest panel and persist to DB.
 * Body (optional): { count?: number }
 */
app.post("/api/discussions/:id/generate", async (req, res) => {
  const { id } = req.params as { id: string };
  const { count = 4 } = (req.body as { count?: number }) ?? {};

  /* Load discussion */
  const discussion = await prisma.discussion.findUnique({ where: { id } });
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

  /* Generate panel via AI */
  console.log(`[api] generating panel for "${discussion.topic}" (count=${count})...`);
  let panelResult;
  try {
    panelResult = await generatePanel(discussion.topic, count);
  } catch (err) {
    console.error("[api] generatePanel failed:", (err as Error).message);
    res.status(500).json({
      success: false,
      error: `AI generation failed: ${(err as Error).message}`,
    });
    return;
  }

  /* Persist participants */
  const participants = await Promise.all(
    panelResult.panel.map((member, index) =>
      prisma.participant.create({
        data: {
          discussion_id: id,
          name: member.name,
          role: index === 0 ? "HOST" : "EXPERT",
          title: member.title,
          stance: member.stance,
          color: EXPERT_COLORS[index % EXPERT_COLORS.length],
        },
      }),
    ),
  );

  /* Update status to CONFIRMED */
  await prisma.discussion.update({
    where: { id },
    data: { status: "CONFIRMED" },
  });

  console.log(
    `[api] panel generated for ${id}: ${participants.length} participants`,
  );
  res.json({ success: true, data: { participants } });
});

/**
 * POST /api/discussions/:id/start
 * Initialise a Scheduler instance for this discussion and store it
 * in the session map. The Scheduler does NOT start ticking until
 * the client sends 'client_confirm' via WebSocket.
 */
app.post("/api/discussions/:id/start", async (req, res) => {
  const { id } = req.params as { id: string };

  /* Load discussion with participants */
  const discussion = await prisma.discussion.findUnique({
    where: { id },
    include: { participants: true },
  });
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

  /* Prevent duplicate sessions */
  if (sessions.has(id)) {
    res.status(409).json({
      success: false,
      error: "Scheduler already initialised for this discussion",
    });
    return;
  }

  /* Build Scheduler */
  const experts = mapParticipantsToExperts(discussion.participants);
  const scheduler = new Scheduler({
    topic: discussion.topic,
    experts,
    tickIntervalMs: 4000,
  });

  /* Wire events: persist + broadcast */
  wireSchedulerEvents(scheduler, id);

  /* Store in session map */
  sessions.set(id, { scheduler, discussionId: id });

  /* Update status */
  await prisma.discussion.update({
    where: { id },
    data: { status: "ONGOING" },
  });

  console.log(
    `[api] scheduler initialised for discussion ${id} (${experts.length} experts)`,
  );
  res.json({
    success: true,
    data: { status: "ONGOING", participantCount: experts.length },
  });
});

/**
 * GET /api/discussions
 * List all discussions (for dashboard).
 */
app.get("/api/discussions", async (_req, res) => {
  const discussions = await prisma.discussion.findMany({
    include: { participants: true },
    orderBy: { created_at: "desc" },
  });
  res.json({ success: true, data: discussions });
});

/**
 * GET /api/discussions/:id
 * Get a single discussion with participants and transcript.
 */
app.get("/api/discussions/:id", async (req, res) => {
  const { id } = req.params as { id: string };
  const discussion = await prisma.discussion.findUnique({
    where: { id },
    include: { participants: true, transcriptEntries: true },
  });
  if (!discussion) {
    res.status(404).json({ success: false, error: "Discussion not found" });
    return;
  }
  res.json({ success: true, data: discussion });
});

/* ───────────────────────────────────────────────────────
   WebSocket — /studio namespace
   ─────────────────────────────────────────────────────── */

const studioNs = io.of("/studio");

studioNs.on("connection", (socket) => {
  console.log(`[ws] client connected: ${socket.id}`);

  /* Join a discussion room */
  socket.on("join", (discussionId: string) => {
    if (!discussionId || typeof discussionId !== "string") return;

    socket.join(discussionId);
    console.log(`[ws] ${socket.id} joined room ${discussionId}`);

    /* Send existing transcript history to the newly joined client */
    prisma.transcriptEntry
      .findMany({
        where: { discussion_id: discussionId },
        orderBy: { timestamp: "asc" },
      })
      .then((entries) => {
        socket.emit("history", {
          discussionId,
          entries: entries.map((e) => ({
            id: e.id,
            speakerId: e.speaker_id,
            content: e.content,
            timestamp: e.timestamp,
          })),
        });
      })
      .catch((err) => {
        console.error(
          `[ws] failed to load history for ${discussionId}:`,
          (err as Error).message,
        );
      });
  });

  /* Client confirms ready — start the Scheduler */
  socket.on("client_confirm", (discussionId: string) => {
    if (!discussionId || typeof discussionId !== "string") return;

    const session = sessions.get(discussionId);
    if (!session) {
      socket.emit("error", {
        message: `No session found for discussion ${discussionId}. Call POST /api/discussions/${discussionId}/start first.`,
      });
      return;
    }

    if (session.scheduler.isRunning()) {
      socket.emit("error", {
        message: "Scheduler is already running for this discussion.",
      });
      return;
    }

    session.scheduler.start();
    console.log(`[ws] scheduler started for discussion ${discussionId}`);
    socket.emit("confirmed", { discussionId, running: true });
  });

  /* Client requests stop */
  socket.on("client_stop", (discussionId: string) => {
    const session = sessions.get(discussionId);
    if (session && session.scheduler.isRunning()) {
      session.scheduler.stop();
      console.log(`[ws] scheduler stopped for discussion ${discussionId}`);
      socket.emit("stopped", { discussionId, running: false });
    }
  });

  socket.on("disconnect", () => {
    console.log(`[ws] client disconnected: ${socket.id}`);
  });
});

/* ── Start ────────────────────────────────────────────── */

httpServer.listen(PORT, () => {
  console.log(`\n🚀 AI Panel Studio server running on http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}/studio\n`);
});

export { app, httpServer, sessions };
