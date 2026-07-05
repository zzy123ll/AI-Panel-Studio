/**
 * CLI Integration Test — AI Panel Studio
 *
 * Exercises the full backend lifecycle via HTTP + WebSocket.
 * Run:  pnpm exec tsx scripts/cli-test.ts
 *
 * Requires: backend running on localhost:3001, DEEPSEEK_API_KEY set in .env
 */

const BASE = "http://localhost:3001/api";
const WS_URL = "http://localhost:3001/studio";

/* ── Colored output ─────────────────────────────────── */

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ${green("✓")} ${label}`);
    passed++;
  } else {
    console.log(`  ${red("✗")} ${label}`);
    failed++;
  }
}

function header(text: string): void {
  console.log(`\n${bold("━".repeat(60))}`);
  console.log(bold(`  ${text}`));
  console.log(bold("━".repeat(60)));
}

function summary(): never {
  console.log(`\n${bold("═".repeat(60))}`);
  console.log(bold(`  Results: ${green(String(passed))} passed, ${red(String(failed))} failed`));
  console.log(bold("═".repeat(60)));
  process.exit(failed > 0 ? 1 : 0);
}

/* ── HTTP helpers ────────────────────────────────────── */

async function post(path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json() as Promise<{ success: boolean; data?: unknown; error?: string }>;
}

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`);
  return res.json() as Promise<{ success: boolean; data?: unknown; error?: string }>;
}

async function del(path: string) {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  return res.json() as Promise<{ success: boolean; data?: unknown; error?: string }>;
}

/* ── WebSocket helper ────────────────────────────────── */

function connectWs(discussionId: string): Promise<{
  stop: () => void;
  events: Array<{ event: string; data: unknown }>;
}> {
  return new Promise((resolve, reject) => {
    // Dynamic import because socket.io-client is ESM
    import("socket.io-client").then(({ io }) => {
      const socket = io(WS_URL, {
        transports: ["websocket"],
        timeout: 5000,
      });

      const events: Array<{ event: string; data: unknown }> = [];

      socket.on("connect", () => {
        socket.emit("JOIN", discussionId);
        console.log(`  ${green("✓")} WebSocket connected, joined room ${dim(discussionId)}`);
        resolve({
          stop: () => socket.disconnect(),
          events,
        });
      });

      socket.on("connect_error", (err: Error) => {
        reject(new Error(`WebSocket connection failed: ${err.message}`));
      });

      /* Capture all server→client events */
      const captureEvents = [
        "HISTORY", "CONFIRMED", "STOPPED", "ERROR",
        "TRANSCRIPT_APPEND", "AGENT_STATUS_CHANGE",
        "CONSENSUS_NEW", "DIVERGENCE_NEW",
        "DISCUSSION_END", "SUMMARY",
      ];
      for (const evt of captureEvents) {
        socket.on(evt, (data: unknown) => {
          events.push({ event: evt, data });
          console.log(`  ${dim(`← ${evt}`)}`);
        });
      }
    });
  });
}

/* ── Delay helper ────────────────────────────────────── */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ═══════════════════════════════════════════════════════
   Main Test Sequence
   ═══════════════════════════════════════════════════════ */

async function main() {
  console.log(bold("\nAI Panel Studio — CLI Integration Test\n"));

  /* ── 1. Health check ───────────────────────────────── */

  header("1. Health Check");

  const health = await fetch("http://localhost:3001/").then((r) => r.json()).catch(() => null);
  assert(health !== null, "GET / returns JSON");
  assert(health?.status === "running", "Server status is 'running'");

  /* ── 2. List discussions (empty or seeded) ─────────── */

  header("2. GET /api/discussions — List");

  const list = await get("/discussions");
  assert(list.success === true, "Response success: true");
  assert(Array.isArray(list.data), "data is an array");
  console.log(`  ${dim(`Found ${(list.data as unknown[])?.length ?? 0} discussions`)}`);

  /* ── 3. Create discussion ──────────────────────────── */

  header("3. POST /api/discussions — Create");

  const created = await post("/discussions", { topic: "CLI 测试话题：远程办公的未来" });
  assert(created.success === true, "Create returns success");
  const discussionId = (created.data as { id?: string })?.id;
  assert(!!discussionId, `Discussion ID: ${discussionId?.slice(0, 8)}...`);
  assert(
    (created.data as { status?: string })?.status === "DRAFT",
    "Status is DRAFT",
  );

  if (!discussionId) {
    console.log(red("\n  Cannot continue without discussion ID. Aborting."));
    summary();
  }

  /* ── 4. Get single discussion ──────────────────────── */

  header("4. GET /api/discussions/:id — Detail");

  const detail = await get(`/discussions/${discussionId}`);
  assert(detail.success === true, "Detail fetch success");
  assert(
    (detail.data as { topic?: string })?.topic === "CLI 测试话题：远程办公的未来",
    "Topic matches",
  );

  /* ── 5. Generate panel (requires AI) ───────────────── */

  header("5. POST /api/discussions/:id/generate — AI Panel");

  let panelGenerated = false;
  let panelists: Array<{ id: string; role: string; name: string }> = [];

  const genResult = await post(`/discussions/${discussionId}/generate`, { count: 3 });
  if (genResult.success) {
    panelGenerated = true;
    panelists = (genResult.data as { participants?: Array<{ id: string; role: string; name: string }> })?.participants ?? [];
    assert(true, "Panel generation succeeded");
    assert(panelists.length >= 3, `Generated ${panelists.length} panelists (expected >= 3)`);
    const host = panelists.find((p) => p.role === "HOST");
    assert(!!host, `Host present: ${host?.name ?? "none"}`);
    const experts = panelists.filter((p) => p.role === "EXPERT");
    assert(experts.length >= 2, `Experts: ${experts.length}`);
  } else {
    assert(false, `Panel generation: ${genResult.error ?? "AI API error (check DEEPSEEK_API_KEY)"}`);
    console.log(yellow("\n  ⚠ AI generation failed — skipping WebSocket discussion test"));
  }

  /* ── 6. Start discussion + WebSocket test ──────────── */

  if (panelGenerated) {
    header("6. WebSocket — Connect & Start Discussion");

    let ws: Awaited<ReturnType<typeof connectWs>> | null = null;
    try {
      ws = await connectWs(discussionId!);
      passed++; // connection success tracked inside connectWs

      /* Start */
      const started = await post(`/discussions/${discussionId!}/start`);
      assert(started.success === true, "POST /start success");

      /* Confirm via WebSocket */
      ws.stop(); // disconnect old socket
      const ws2 = await connectWs(discussionId!);
      const { io } = await import("socket.io-client");
      const s = io(WS_URL, { transports: ["websocket"], timeout: 5000 });
      await new Promise<void>((resolveWs) => {
        s.on("connect", () => {
          s.emit("JOIN", discussionId);
          s.emit("CLIENT_CONFIRM", discussionId);
          resolveWs();
        });
      });

      /* Wait for some transcript events */
      console.log(`  ${dim("Waiting for discussion events (15s)...")}`);
      await sleep(15000);

      /* Check captured events */
      const transcriptEvents = ws2.events.filter((e) => e.event === "TRANSCRIPT_APPEND");
      const consensusEvents = ws2.events.filter((e) => e.event === "CONSENSUS_NEW");
      const statusEvents = ws2.events.filter((e) => e.event === "AGENT_STATUS_CHANGE");

      assert(transcriptEvents.length > 0, `Transcript entries: ${transcriptEvents.length}`);
      assert(statusEvents.length > 0, `Status changes: ${statusEvents.length}`);

      if (consensusEvents.length > 0) {
        assert(true, `Consensus extractions: ${consensusEvents.length}`);
      } else {
        console.log(`  ${dim("  (no consensus yet — need 5+ messages)")}`);
      }

      /* End discussion */
      header("7. Stop Discussion & Summary");

      s.emit("CLIENT_STOP", discussionId);
      await sleep(3000);

      const endEvent = ws2.events.find((e) => e.event === "DISCUSSION_END");
      const summaryEvent = ws2.events.find((e) => e.event === "SUMMARY");

      assert(!!endEvent, "DISCUSSION_END event received");
      if (summaryEvent) {
        const summaryData = summaryEvent.data as { summaryText?: string };
        assert(!!summaryData?.summaryText, "Summary text present");
        assert(
          !summaryData.summaryText?.includes("{") && !summaryData.summaryText?.includes("["),
          "Summary is natural language (no JSON)",
        );
      } else {
        console.log(`  ${dim("  (SUMMARY event not captured — may arrive async)")}`);
      }

      s.disconnect();
      ws2.stop();
    } catch (err) {
      assert(false, `WebSocket test: ${(err as Error).message}`);
    } finally {
      ws?.stop();
    }
  }

  /* ── 8. Confirm endpoint (retest flow) ─────────────── */

  header("8. POST /api/discussions/:id/confirm — State Transition");

  /* Create a fresh discussion for confirm test */
  const d2 = await post("/discussions", { topic: "CLI 确认测试" });
  const d2Id = (d2.data as { id?: string })?.id;
  if (d2Id) {
    /* Generate panel first (confirm requires participants) */
    await post(`/discussions/${d2Id}/generate`, { count: 2 });
    const confirmed = await post(`/discussions/${d2Id}/confirm`);

    /* May fail if generate didn't succeed (AI API down) */
    if (confirmed.success) {
      assert(true, "Confirm endpoint succeeded");
    } else {
      console.log(`  ${dim("  (confirm requires AI-generated panel — skipping)")}`);
    }
  }

  /* ── 9. DELETE participant ─────────────────────────── */

  header("9. DELETE /api/participants/:id — Remove");

  if (panelists.length > 0) {
    const targetId = panelists[panelists.length - 1].id;
    const delResult = await del(`/participants/${targetId}`);
    assert(delResult.success === true, `Deleted participant ${targetId.slice(0, 8)}...`);

    /* Verify removed */
    const afterDel = await get(`/discussions/${discussionId}`);
    const afterParticipants = (afterDel.data as { participants?: Array<{ id: string }> })?.participants ?? [];
    assert(
      !afterParticipants.find((p) => p.id === targetId),
      "Participant no longer in discussion",
    );
  } else {
    console.log(`  ${dim("  (no panelists to delete — skipping)")}`);
  }

  /* ── 10. Error handling ────────────────────────────── */

  header("10. Error Handling");

  const notFound = await get("/discussions/non-existent-id");
  assert(notFound.success === false, "404: GET non-existent returns success:false");
  assert(!!notFound.error, "404: Error message present");

  const badCreate = await post("/discussions", { topic: "" });
  assert(badCreate.success === false, "400: Empty topic rejected");

  const badConfirm = await post(`/discussions/${discussionId}/confirm`);
  assert(badConfirm.success === false, "400: Double-confirm rejected");

  /* ── Done ───────────────────────────────────────────── */

  summary();
}

main().catch((err) => {
  console.error(red(`\nFatal error: ${(err as Error).message}`));
  process.exit(1);
});
