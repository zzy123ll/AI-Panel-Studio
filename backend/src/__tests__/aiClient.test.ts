/* ───────────────────────────────────────────────────────
   Mock sleep to make retry tests instantaneous
   ─────────────────────────────────────────────────────── */

jest.mock("../infrastructure/sleep.js", () => ({
  sleep: jest.fn(),
}));

import { sleep } from "../infrastructure/sleep.js";
import {
  generatePanel,
  decideAction,
  extractConsensus,
} from "../infrastructure/aiClient.js";

const mockedSleep = sleep as jest.Mock;

/* ───────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────── */

function mockFetchOk(body: unknown) {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function mockFetchSequence(
  responses: Array<{ body: unknown; status: number }>,
) {
  let call = 0;
  return jest.fn().mockImplementation(() => {
    const r = responses[Math.min(call, responses.length - 1)];
    call++;
    return Promise.resolve({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: () => Promise.resolve(r.body),
    });
  });
}

const PANEL_JSON = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          panel: [{ name: "张维远", title: "AI 研究员", stance: "严格监管" }],
        }),
      },
    },
  ],
};

const ACTION_JSON = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          intent: "ASK",
          content: "您怎么看这个问题？",
        }),
      },
    },
  ],
};

const CONSENSUS_JSON = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          consensus: ["需要加强监管"],
          divergences: [
            { topic: "监管力度", positions: ["严格", "宽松"] },
          ],
        }),
      },
    },
  ],
};

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = "sk-test-mock-key";
  global.fetch = mockFetchOk(PANEL_JSON);
  mockedSleep.mockResolvedValue(undefined);
  mockedSleep.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

/* ───────────────────────────────────────────────────────
   generatePanel
   ─────────────────────────────────────────────────────── */

describe("generatePanel", () => {
  it("calls fetch with correct request body", async () => {
    const fetchSpy = (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(PANEL_JSON),
      }),
    );

    await generatePanel("AI 安全", 3);

    const reqBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(reqBody.model).toBe("deepseek-chat");
    expect(reqBody.messages).toHaveLength(2);
    expect(reqBody.messages[0].role).toBe("system");
    expect(reqBody.messages[1].role).toBe("user");
  });

  it("returns parsed panel JSON on success", async () => {
    const result = await generatePanel("AI 安全", 2);
    expect(result).toHaveProperty("panel");
    expect(result.panel).toBeInstanceOf(Array);
    expect(result.panel[0]).toHaveProperty("name");
    expect(result.panel[0]).toHaveProperty("title");
    expect(result.panel[0]).toHaveProperty("stance");
  });

  it("throws when DEEPSEEK_API_KEY is not set", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    await expect(generatePanel("test", 2)).rejects.toThrow("DEEPSEEK_API_KEY");
  });

  it(
    "retries up to 3 times on network error then throws",
    async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("ECONNRESET"));

      await expect(generatePanel("test", 2)).rejects.toThrow("ECONNRESET");
      // initial + 3 retries = 4 total calls
      expect(global.fetch).toHaveBeenCalledTimes(4);
    },
    15000,
  );

  it(
    "succeeds on the third attempt after two failures",
    async () => {
      (global.fetch as jest.Mock) = mockFetchSequence([
        { body: {}, status: 500 },
        { body: {}, status: 500 },
        { body: PANEL_JSON, status: 200 },
      ]);

      const result = await generatePanel("test", 2);
      expect(result.panel).toHaveLength(1);
      // 2 failures + 1 success = 3 calls
      expect(global.fetch).toHaveBeenCalledTimes(3);
      // sleep was called after each failure
      expect(mockedSleep).toHaveBeenCalledTimes(2);
    },
    15000,
  );
});

/* ───────────────────────────────────────────────────────
   decideAction
   ─────────────────────────────────────────────────────── */

describe("decideAction", () => {
  const mockContext = { status: "ONGOING", round: 2 };

  it("returns { intent, content } on success", async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(ACTION_JSON),
      }),
    );

    const result = await decideAction(mockContext, "张老师：我同意这个观点。");
    expect(result).toHaveProperty("intent");
    expect(result).toHaveProperty("content");
    expect(result.intent).toBe("ASK");
  });

  it("throws on malformed JSON response", async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: "not valid {{ json" } }],
          }),
      }),
    );

    await expect(
      decideAction(mockContext, "transcript..."),
    ).rejects.toThrow("Failed to parse");
  });

  it("throws on timeout (AbortError)", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(
      Object.assign(new Error("The operation was aborted"), {
        name: "AbortError",
      }),
    );

    await expect(
      decideAction(mockContext, "transcript..."),
    ).rejects.toThrow("timed out");
  });
});

/* ───────────────────────────────────────────────────────
   extractConsensus
   ─────────────────────────────────────────────────────── */

describe("extractConsensus", () => {
  it("returns { consensus, divergences } on success", async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(CONSENSUS_JSON),
      }),
    );

    const result = await extractConsensus("讨论记录...");
    expect(result).toHaveProperty("consensus");
    expect(result).toHaveProperty("divergences");
    expect(result.consensus).toBeInstanceOf(Array);
    expect(result.divergences).toBeInstanceOf(Array);
  });

  it(
    "retries on 429 rate-limit then succeeds",
    async () => {
      (global.fetch as jest.Mock) = mockFetchSequence([
        { body: { error: "rate_limited" }, status: 429 },
        { body: CONSENSUS_JSON, status: 200 },
      ]);

      const result = await extractConsensus("transcript...");
      expect(result.consensus).toEqual(["需要加强监管"]);
      expect(result.divergences).toEqual([
        { topic: "监管力度", positions: ["严格", "宽松"] },
      ]);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(mockedSleep).toHaveBeenCalledTimes(1);
    },
    15000,
  );
});
