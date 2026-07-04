/* ───────────────────────────────────────────────────────
   Mock aiClient.decideAction for controlled test behavior
   ─────────────────────────────────────────────────────── */

jest.mock("../infrastructure/aiClient.js", () => ({
  decideAction: jest.fn(),
}));

import { decideAction } from "../infrastructure/aiClient.js";
import { Scheduler } from "../agents/Scheduler.js";
import type { Expert, NewMessagePayload } from "../agents/Scheduler.js";

const mockedDecideAction = decideAction as jest.Mock;

/* ───────────────────────────────────────────────────────
   Test fixtures
   ─────────────────────────────────────────────────────── */

const mockExperts: Expert[] = [
  { id: "host-1", name: "张维远", stance: "严格监管", isHost: true },
  { id: "exp-2", name: "陈思然", stance: "放任自流", isHost: false },
  { id: "exp-3", name: "刘启明", stance: "行业自律", isHost: false },
  { id: "exp-4", name: "王若琳", stance: "严格监管", isHost: false },
];

function mockAction(intent: string, content: string) {
  return { intent, content };
}

/**
 * Set up a Math.random spy that returns `value` for every call.
 */
function mockRandomAlways(value: number) {
  return jest.spyOn(Math, "random").mockReturnValue(value);
}

beforeEach(() => {
  mockedDecideAction.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

/* ───────────────────────────────────────────────────────
   State machine tests
   ─────────────────────────────────────────────────────── */

describe("Scheduler state machine", () => {
  it("all experts start in idle state", () => {
    const scheduler = new Scheduler({
      topic: "AI 安全",
      experts: mockExperts,
    });

    const states = scheduler.getExpertStates();
    expect(states).toHaveLength(4);
    for (const s of states) {
      expect(s.state).toBe("idle");
    }
  });

  it("transitions selected expert through idle → preparing → speaking → idle", async () => {
    const scheduler = new Scheduler({
      topic: "AI 安全",
      experts: mockExperts,
    });

    // Fisher-Yates (3 iters for 4 idle) + count: all 0.25
    // This yields exp-4 as the single selected expert
    mockRandomAlways(0.25);

    mockedDecideAction.mockResolvedValueOnce(
      mockAction("interject", "我认为监管是必要的"),
    );

    const messages: NewMessagePayload[] = [];
    scheduler.on("newMessage", (msg: NewMessagePayload) => messages.push(msg));

    // Before tick: all idle
    expect(scheduler.getExpertStates().map((s) => s.state)).toEqual([
      "idle",
      "idle",
      "idle",
      "idle",
    ]);

    await scheduler.tick();

    // After tick with successful speak: speaker returns to idle
    const postStates = scheduler.getExpertStates();
    const speakerState = postStates.find((s) => s.expertId === "exp-4");
    expect(speakerState?.state).toBe("idle");

    expect(messages).toHaveLength(1);
    expect(messages[0].expertId).toBe("exp-4");
  });

  it("returns experts to idle when AI returns no intent to speak", async () => {
    const scheduler = new Scheduler({
      topic: "AI 安全",
      experts: mockExperts,
    });

    mockRandomAlways(0.25);
    mockedDecideAction.mockResolvedValueOnce(mockAction("WAIT", ""));

    await scheduler.tick();

    // All should be idle — nobody spoke
    for (const s of scheduler.getExpertStates()) {
      expect(s.state).toBe("idle");
    }
  });
});

/* ───────────────────────────────────────────────────────
   Tick selection tests
   ─────────────────────────────────────────────────────── */

describe("Scheduler tick selection", () => {
  it("picks 1–2 idle experts per tick", async () => {
    const scheduler = new Scheduler({
      topic: "AI 安全",
      experts: mockExperts,
    });

    // 0.25 → count=1 (0.25 < 0.5)
    mockRandomAlways(0.25);
    mockedDecideAction.mockResolvedValueOnce(mockAction("WAIT", ""));

    await scheduler.tick();

    const callCount = mockedDecideAction.mock.calls.length;
    expect(callCount).toBeGreaterThanOrEqual(1);
    expect(callCount).toBeLessThanOrEqual(2);
  });

  it("only selects from idle experts, excluding last speaker", async () => {
    const subset: Expert[] = [
      { id: "e1", name: "A", stance: "X", isHost: false },
      { id: "e2", name: "B", stance: "Y", isHost: false },
      { id: "e3", name: "C", stance: "Z", isHost: false },
    ];

    const scheduler = new Scheduler({ topic: "测试", experts: subset });

    // Tick 1: 0.25 shuffle → [e2, e3, e1], count=1 → e2 speaks
    mockRandomAlways(0.25);
    mockedDecideAction.mockResolvedValueOnce(
      mockAction("interject", "B speaks"),
    );

    await scheduler.tick();
    // lastSpeakerId = "e2"

    // Tick 2: e2 excluded. idle = [e1, e3]
    // 0.75 shuffle no-swap, 0.75 count=2 → [e1, e3]
    jest.spyOn(Math, "random")
      .mockReturnValueOnce(0.75) // shuffle i=1: no swap
      .mockReturnValueOnce(0.75); // count: 2

    mockedDecideAction
      .mockResolvedValueOnce(mockAction("WAIT", ""))
      .mockResolvedValueOnce(mockAction("WAIT", ""));

    await scheduler.tick();

    // Verify tick 2 calls do NOT include e2 (the last speaker)
    const allCalls = mockedDecideAction.mock.calls;
    const tick2Call1 = allCalls[1] as [Record<string, unknown>, string];
    const tick2Call2 = allCalls[2] as [Record<string, unknown>, string];
    expect(tick2Call1[0].expertId).not.toBe("e2");
    expect(tick2Call2[0].expertId).not.toBe("e2");
  });

  it("picks 2 experts when random > 0.5 for count", async () => {
    const scheduler = new Scheduler({
      topic: "AI 安全",
      experts: mockExperts,
    });

    // 0.75: no swaps in Fisher-Yates, count=2 → picks first 2 experts
    mockRandomAlways(0.75);
    mockedDecideAction
      .mockResolvedValueOnce(mockAction("WAIT", ""))
      .mockResolvedValueOnce(mockAction("WAIT", ""));

    await scheduler.tick();

    expect(mockedDecideAction.mock.calls.length).toBe(2);
  });
});

/* ───────────────────────────────────────────────────────
   Conflict resolution tests
   ─────────────────────────────────────────────────────── */

describe("Scheduler conflict resolution", () => {
  it("host wins when host and non-host both want to speak", async () => {
    // Use exactly 2 experts: host + non-host. Both selected with 0.75 mock.
    const twoExperts: Expert[] = [mockExperts[0], mockExperts[1]];

    const scheduler = new Scheduler({
      topic: "AI 安全",
      experts: twoExperts,
    });

    // 0.75: shuffle no-swap, count=2 → both selected
    mockRandomAlways(0.75);

    mockedDecideAction
      .mockResolvedValueOnce(mockAction("interject", "host opinion"))
      .mockResolvedValueOnce(mockAction("interject", "expert opinion"));

    const messages: NewMessagePayload[] = [];
    scheduler.on("newMessage", (msg: NewMessagePayload) => messages.push(msg));

    await scheduler.tick();

    // Conflict resolved — only one message
    expect(messages).toHaveLength(1);
    expect(messages[0].expertId).toBe("host-1");
    expect(messages[0].content).toBe("host opinion");
  });

  it("resolves tie by picking first candidate when opposition is equal", async () => {
    // Use 3 non-host experts to enable multi-tick scenario
    const threeExperts: Expert[] = [
      { id: "e1", name: "A", stance: "立场甲", isHost: false },
      { id: "e2", name: "B", stance: "立场乙", isHost: false },
      { id: "e3", name: "C", stance: "立场丙", isHost: false },
    ];

    const scheduler = new Scheduler({ topic: "测试", experts: threeExperts });

    // Tick 1: 0.25 → e3 speaks → lastStance = "立场丙"
    mockRandomAlways(0.25);
    mockedDecideAction.mockResolvedValueOnce(
      mockAction("interject", "C speaks"),
    );
    await scheduler.tick();

    // Tick 2: e3 excluded. idle = [e1, e2]
    // Shuffle i=1 j=1 (0.75 no swap), count=2 (0.75) → [e1, e2]
    jest.spyOn(Math, "random")
      .mockReturnValueOnce(0.75) // shuffle: no swap
      .mockReturnValueOnce(0.75); // count: 2

    // Both want to speak, both equally opposed (binary: both different from "立场丙")
    mockedDecideAction
      .mockResolvedValueOnce(mockAction("interject", "A wants speak"))
      .mockResolvedValueOnce(mockAction("interject", "B wants speak"));

    const messages: NewMessagePayload[] = [];
    scheduler.on("newMessage", (msg: NewMessagePayload) => messages.push(msg));

    await scheduler.tick();

    // First candidate (e1) wins the tie
    expect(messages).toHaveLength(1);
    expect(messages[0].expertId).toBe("e1");
    expect(messages[0].content).toBe("A wants speak");
  });

  it("picks expert with higher stance opposition (different vs same as last speaker)", async () => {
    // Experts: e-a(立场X), e-b(立场Y), e-c(立场X)
    // Goal: e-a speaks first (立场X). Then e-b(立场Y) and e-c(立场X) both want to speak.
    // e-b wins because "立场Y" differs from lastStance "立场X" (opp=1)
    // vs e-c which is same (opp=0).
    const experts: Expert[] = [
      { id: "e-a", name: "A", stance: "立场X", isHost: false },
      { id: "e-b", name: "B", stance: "立场Y", isHost: false },
      { id: "e-c", name: "C", stance: "立场X", isHost: false },
    ];

    const scheduler = new Scheduler({ topic: "测试", experts });

    // Tick 1: 0.75 no-swap shuffle (2 iters), 0.25 count=1 → [e-a] speaks
    jest.spyOn(Math, "random")
      .mockReturnValueOnce(0.75) // i=2: no swap
      .mockReturnValueOnce(0.75) // i=1: no swap
      .mockReturnValueOnce(0.25); // count=1

    mockedDecideAction.mockResolvedValueOnce(
      mockAction("interject", "A speaks"),
    );
    await scheduler.tick();
    // lastStance = "立场X", lastSpeakerId = "e-a"

    // Tick 2: e-a excluded. idle = [e-b(立场Y), e-c(立场X)]
    // 0.75 no-swap (1 iter), 0.75 count=2 → [e-b, e-c]
    jest.spyOn(Math, "random")
      .mockReturnValueOnce(0.75) // i=1: no swap
      .mockReturnValueOnce(0.75); // count=2

    mockedDecideAction
      .mockResolvedValueOnce(mockAction("interject", "B challenges"))
      .mockResolvedValueOnce(mockAction("interject", "C agrees"));

    const messages: NewMessagePayload[] = [];
    scheduler.on("newMessage", (msg: NewMessagePayload) => messages.push(msg));

    await scheduler.tick();

    // e-b (different stance) should win over e-c (same stance)
    expect(messages).toHaveLength(1);
    expect(messages[0].expertId).toBe("e-b");
    expect(messages[0].content).toBe("B challenges");
  });
});

/* ───────────────────────────────────────────────────────
   No consecutive same speaker
   ─────────────────────────────────────────────────────── */

describe("Scheduler prevents consecutive same speaker", () => {
  it("excludes last speaker from the next tick selection", async () => {
    const scheduler = new Scheduler({
      topic: "AI 安全",
      experts: mockExperts,
    });

    // Tick 1: 0.75 no-swap shuffle, 0.25 count=1 → host-1 selected
    jest.spyOn(Math, "random")
      .mockReturnValueOnce(0.75) // shuffle i=3
      .mockReturnValueOnce(0.75) // shuffle i=2
      .mockReturnValueOnce(0.75) // shuffle i=1
      .mockReturnValueOnce(0.25); // count=1

    mockedDecideAction.mockResolvedValueOnce(
      mockAction("interject", "first speech"),
    );

    const messages: NewMessagePayload[] = [];
    scheduler.on("newMessage", (msg: NewMessagePayload) => messages.push(msg));

    await scheduler.tick();
    expect(messages).toHaveLength(1);
    expect(messages[0].expertId).toBe("host-1");

    // Tick 2: host-1 is last speaker, excluded. idle = [exp-2, exp-3, exp-4]
    // Fisher-Yates with 3: 2 iters. 0.75 no-swap.
    // 0.25 count: count=1 → [exp-2]
    jest.spyOn(Math, "random")
      .mockReturnValueOnce(0.75) // shuffle i=2
      .mockReturnValueOnce(0.75) // shuffle i=1
      .mockReturnValueOnce(0.25); // count=1

    mockedDecideAction.mockResolvedValueOnce(mockAction("WAIT", ""));

    await scheduler.tick();

    // Verify the call in tick 2 was NOT for host-1
    const lastCall = mockedDecideAction.mock.calls[
      mockedDecideAction.mock.calls.length - 1
    ] as [Record<string, unknown>, string];
    expect(lastCall[0].expertId).not.toBe("host-1");
  });
});

/* ───────────────────────────────────────────────────────
   Event emission
   ─────────────────────────────────────────────────────── */

describe("Scheduler event emission", () => {
  it("emits 'newMessage' with correct payload on interject", async () => {
    const scheduler = new Scheduler({
      topic: "AI 安全",
      experts: mockExperts,
    });

    mockRandomAlways(0.25);
    mockedDecideAction.mockResolvedValueOnce(
      mockAction("interject", "我认为需要更严格的监管框架"),
    );

    const messagePromise = new Promise<NewMessagePayload>((resolve) => {
      scheduler.once("newMessage", (msg: NewMessagePayload) => resolve(msg));
    });

    await scheduler.tick();

    const msg = await messagePromise;
    expect(msg).toMatchObject({
      expertId: expect.any(String) as string,
      expertName: expect.any(String) as string,
      content: "我认为需要更严格的监管框架",
      intent: "interject",
      timestamp: expect.any(Number) as number,
    });

    jest.restoreAllMocks();
  });

  it("emits 'newMessage' with rebut intent", async () => {
    const scheduler = new Scheduler({
      topic: "AI 安全",
      experts: mockExperts,
    });

    mockRandomAlways(0.25);
    mockedDecideAction.mockResolvedValueOnce(
      mockAction("rebut", "我不同意上一位的观点"),
    );

    const messagePromise = new Promise<NewMessagePayload>((resolve) => {
      scheduler.once("newMessage", (msg: NewMessagePayload) => resolve(msg));
    });

    await scheduler.tick();

    const msg = await messagePromise;
    expect(msg.intent).toBe("rebut");
    expect(msg.content).toBe("我不同意上一位的观点");
  });

  it("does NOT emit when no expert wants to speak", async () => {
    const scheduler = new Scheduler({
      topic: "AI 安全",
      experts: mockExperts,
    });

    mockRandomAlways(0.25);
    mockedDecideAction.mockResolvedValueOnce(mockAction("WAIT", ""));

    const callback = jest.fn();
    scheduler.on("newMessage", callback);

    await scheduler.tick();

    expect(callback).not.toHaveBeenCalled();
  });
});

/* ───────────────────────────────────────────────────────
   Start / Stop
   ─────────────────────────────────────────────────────── */

describe("Scheduler start/stop", () => {
  it("start() begins the tick interval", () => {
    jest.useFakeTimers();

    const scheduler = new Scheduler({
      topic: "AI 安全",
      experts: mockExperts,
      tickIntervalMs: 4000,
    });

    const tickSpy = jest.spyOn(scheduler, "tick").mockResolvedValue(undefined);

    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);

    // Advance past first interval
    jest.advanceTimersByTime(4000);
    expect(tickSpy).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(4000);
    expect(tickSpy).toHaveBeenCalledTimes(2);

    scheduler.stop();
    tickSpy.mockRestore();
    jest.useRealTimers();
  });

  it("stop() halts the tick interval", () => {
    jest.useFakeTimers();

    const scheduler = new Scheduler({
      topic: "AI 安全",
      experts: mockExperts,
      tickIntervalMs: 4000,
    });

    const tickSpy = jest.spyOn(scheduler, "tick").mockResolvedValue(undefined);

    scheduler.start();
    jest.advanceTimersByTime(4000);
    expect(tickSpy).toHaveBeenCalledTimes(1);

    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);

    jest.advanceTimersByTime(8000);
    // No more ticks after stop
    expect(tickSpy).toHaveBeenCalledTimes(1);

    tickSpy.mockRestore();
    jest.useRealTimers();
  });

  it("default tick interval is 4000ms", () => {
    const scheduler = new Scheduler({
      topic: "AI 安全",
      experts: mockExperts,
    });

    expect(scheduler.tickInterval).toBe(4000);
  });
});

/* ───────────────────────────────────────────────────────
   Transcript accumulation
   ─────────────────────────────────────────────────────── */

describe("Scheduler transcript", () => {
  it("accumulates transcript entries after each speech", async () => {
    const scheduler = new Scheduler({
      topic: "AI 安全",
      experts: mockExperts,
    });

    // Tick 1: host-1 speaks (0.75 no-swap, 0.25 count=1)
    jest.spyOn(Math, "random")
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.25);

    mockedDecideAction.mockResolvedValueOnce(
      mockAction("interject", "第一段发言"),
    );

    await scheduler.tick();

    // Tick 2: host-1 excluded, idle=[exp-2,exp-3,exp-4]
    // 0.75 no-swap, 0.25 count=1 → exp-2 speaks
    jest.spyOn(Math, "random")
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.25);

    mockedDecideAction.mockResolvedValueOnce(
      mockAction("interject", "第二段发言"),
    );

    await scheduler.tick();

    const transcript = scheduler.getTranscript();
    expect(transcript).toHaveLength(2);
    expect(transcript[0].content).toBe("第一段发言");
    expect(transcript[1].content).toBe("第二段发言");
    // Each entry should have a unique id (uses counter, not Math.random)
    expect(transcript[0].id).not.toBe(transcript[1].id);
  });

  it("passes transcript history to decideAction", async () => {
    const scheduler = new Scheduler({
      topic: "AI 安全",
      experts: mockExperts,
    });

    // Tick 1: host-1 speaks
    jest.spyOn(Math, "random")
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.25);

    mockedDecideAction.mockResolvedValueOnce(
      mockAction("interject", "历史发言"),
    );
    await scheduler.tick();

    // Tick 2: history should include the first speech
    jest.spyOn(Math, "random")
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.25);

    mockedDecideAction.mockResolvedValueOnce(mockAction("WAIT", ""));

    await scheduler.tick();

    // Check that the second call received history containing the first speech
    const secondCallArgs = mockedDecideAction.mock.calls[1] as [
      Record<string, unknown>,
      string,
    ];

    expect(secondCallArgs[1]).toContain("历史发言");
  });
});
