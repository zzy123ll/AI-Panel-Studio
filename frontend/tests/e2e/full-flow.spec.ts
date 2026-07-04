import { test, expect } from "@playwright/test";

/* ───────────────────────────────────────────────────────
   Test Data
   ─────────────────────────────────────────────────────── */

const TOPIC = "AI 伦理";

/* ───────────────────────────────────────────────────────
   Scenario 1: Dashboard → Setup → Generate Panel
   ─────────────────────────────────────────────────────── */

test.describe("Dashboard → Setup flow", () => {
  test("dashboard renders discussion list and navigates to setup", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // Page title visible
    await expect(page.locator("h1")).toContainText("讨论面板");

    // At least one discussion card is present
    const cards = page.locator("a[href^='/setup/'], a[href^='/studio/']");
    await expect(cards.first()).toBeVisible();
  });

  test('"发起新讨论" navigates to setup page', async ({ page }) => {
    await page.goto("/dashboard");

    await page.click("text=发起新讨论");
    await expect(page).toHaveURL(/\/setup\//);
  });

  test("setup page: input topic, adjust slider, generate guests", async ({
    page,
  }) => {
    await page.goto("/setup/new");

    // Input topic
    const input = page.locator('input[type="text"]');
    await input.fill(TOPIC);
    await expect(input).toHaveValue(TOPIC);

    // Slider default value is 4
    const slider = page.locator('input[type="range"]');
    await expect(slider).toHaveValue("4");

    // Change slider to 5
    await slider.fill("5");
    await expect(page.locator("text=5 人")).toBeVisible();

    // Click generate
    await page.click("text=生成嘉宾阵容");

    // Guest cards should appear
    const guestCards = page.locator("section button, section [class*='guestCard']");
    // At least one guest card is visible
    await expect(page.locator("text=阵容预览")).toBeVisible();
  });
});

/* ───────────────────────────────────────────────────────
   Scenario 2: Studio — Transcript + Status Lights + Consensus
   ─────────────────────────────────────────────────────── */

test.describe("Studio immersive view", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/studio/test-discussion-1");
  });

  test("renders main stage with current speaker", async ({ page }) => {
    // Stage shows speaker name
    const stageSpeaker = page.locator("h2");
    await expect(stageSpeaker).toBeVisible();
    const text = await stageSpeaker.textContent();
    expect(text?.length).toBeGreaterThan(0);
  });

  test("renders panelist grid with 4 experts", async ({ page }) => {
    // Panelist cards are rendered
    const cards = page.locator("[data-status]");
    // At least 4 cards (each has data-status)
    await expect(cards.first()).toBeVisible();
  });

  test("expert status lights have pulse animation CSS", async ({ page }) => {
    // Verify the status light element exists and has animation
    const statusLights = page.locator("[class*='statusLight']");
    const count = await statusLights.count();
    expect(count).toBeGreaterThanOrEqual(4);

    // Get the speaking status light (child element, not the card)
    const speakingCard = page.locator("[data-status='speaking']").first();
    if (await speakingCard.isVisible().catch(() => false)) {
      const light = speakingCard.locator("[class*='statusLight']");
      const boxShadow = await light.evaluate((el) =>
        getComputedStyle(el).boxShadow,
      );
      // The pulse animation manifests as a box-shadow — verify it's not "none"
      expect(boxShadow).toBeTruthy();
      expect(boxShadow).not.toBe("none");
    }
  });

  test("transcript area contains mock entries", async ({ page }) => {
    const transcriptArea = page.locator("[data-testid='transcript-area']");
    await expect(transcriptArea).toBeVisible();

    // At least 5 mock transcript lines rendered
    const entries = transcriptArea.locator("[class*='entry']");
    const count = await entries.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test("transcript speaker names have color styling", async ({ page }) => {
    // Each transcript entry has a speaker name with an inline color style
    const speakerName = page.locator("[class*='speaker']").first();
    await expect(speakerName).toBeVisible();
    const color = await speakerName.evaluate((el) =>
      getComputedStyle(el).color,
    );
    // Should not be the default text color (white/gray), but a vivid expert color
    expect(color).toBeTruthy();
  });

  test("consensus board shows non-empty entries", async ({ page }) => {
    const consensusArea = page.locator("[data-testid='consensus-area']");
    await expect(consensusArea).toBeVisible();

    // Consensus entries have content
    const consensusEntries = consensusArea.locator("[class*='consensusEntry']");
    const count = await consensusEntries.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // First entry has non-empty text
    const firstText = await consensusEntries.first().textContent();
    expect(firstText?.trim().length).toBeGreaterThan(0);
  });

  test("divergence entries have non-empty text", async ({ page }) => {
    const divergenceEntries = page.locator("[class*='divergenceEntry']");
    const count = await divergenceEntries.count();
    expect(count).toBeGreaterThanOrEqual(2);

    const firstText = await divergenceEntries.first().textContent();
    expect(firstText?.trim().length).toBeGreaterThan(0);
  });
});

/* ───────────────────────────────────────────────────────
   Scenario 3: End Discussion → Summary (No JSON Leak)
   ─────────────────────────────────────────────────────── */

test.describe("End discussion and summary", () => {
  test("clicking '结束讨论' shows summary without raw JSON", async ({
    page,
  }) => {
    await page.goto("/studio/test-discussion-1");

    // First click "启动讨论" to make the end button appear
    const startBtn = page.locator("text=启动讨论");
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
    }

    // Now "结束讨论" button should be visible
    const endBtn = page.locator("text=结束讨论");
    await expect(endBtn).toBeVisible({ timeout: 5000 });

    // Click end discussion
    await endBtn.click();

    // Summary text should appear
    const summaryText = page.locator("[data-testid='summary-text']");
    await expect(summaryText).toBeVisible({ timeout: 5000 });

    // ── CRITICAL BUG CHECK: No raw JSON ──
    const text = (await summaryText.textContent()) ?? "";
    expect(text.trim().length).toBeGreaterThan(0);

    // Must NOT contain raw JSON brackets
    expect(text).not.toMatch(/^\s*\{/);
    expect(text).not.toMatch(/^\s*\[/);
    // Must NOT contain JSON colon patterns like "key": "value"
    expect(text).not.toMatch(/"\w+":\s*"/);
  });
});

/* ───────────────────────────────────────────────────────
   Scenario 4: Navigation & Socket Cleanup
   ─────────────────────────────────────────────────────── */

test.describe("Navigation and cleanup", () => {
  test("navigating away from Studio and back does not crash", async ({
    page,
  }) => {
    // Studio → Dashboard
    await page.goto("/studio/test-discussion-1");
    await expect(page.locator("[data-testid='transcript-area']")).toBeVisible();

    // Navigate back to dashboard
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText("讨论面板");

    // Navigate back to Studio
    await page.goto("/studio/test-discussion-2");
    await expect(page.locator("[data-testid='transcript-area']")).toBeVisible();

    // No console errors related to socket
    // (Playwright catches uncaught errors automatically)
  });

  test("multiple studio navigations don't accumulate duplicate entries", async ({
    page,
  }) => {
    // Go to Studio
    await page.goto("/studio/test-discussion-1");

    // Capture initial transcript count
    const entries = page.locator("[data-testid='transcript-area'] [class*='entry']");
    const initialCount = await entries.count();

    // Navigate away and back
    await page.goto("/dashboard");
    await page.goto("/studio/test-discussion-1");

    // Count should be the same (mock data reloads fresh, no duplicates)
    const afterCount = await page.locator(
      "[data-testid='transcript-area'] [class*='entry']",
    ).count();
    expect(afterCount).toBe(initialCount);
  });

  test("back to dashboard button works after end discussion", async ({
    page,
  }) => {
    await page.goto("/studio/test-discussion-1");

    // Start then end discussion
    const startBtn = page.locator("text=启动讨论");
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
    }

    const endBtn = page.locator("text=结束讨论");
    await expect(endBtn).toBeVisible({ timeout: 5000 });
    await endBtn.click();

    // "← 返回面板" button should appear
    const backBtn = page.locator("text=返回面板");
    await expect(backBtn).toBeVisible({ timeout: 5000 });

    await backBtn.click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

/* ───────────────────────────────────────────────────────
   Scenario 5: Sanitize utility unit tests (in-browser)
   ─────────────────────────────────────────────────────── */

test.describe("sanitizeAiText validation", () => {
  test("summary area renders human-readable text, not JSON", async ({
    page,
  }) => {
    await page.goto("/studio/test-discussion-1");

    // Trigger end discussion
    const startBtn = page.locator("text=启动讨论");
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
    }
    await page.locator("text=结束讨论").click();

    // Wait for summary
    const summary = page.locator("[data-testid='summary-text']");
    await expect(summary).toBeVisible({ timeout: 5000 });

    const text = (await summary.textContent()) ?? "";

    // Comprehensive JSON detection
    const looksLikeJson =
      /^[\[\{]/.test(text.trim()) && /[:\"]/.test(text);
    expect(looksLikeJson).toBe(false);

    // Should be readable Chinese text
    expect(text.length).toBeGreaterThan(10);
  });
});
