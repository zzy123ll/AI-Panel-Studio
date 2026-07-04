import { test, expect } from "@playwright/test";

/**
 * E2E Scenario 2: Parallel Discussion Isolation
 *
 * Verifies that opening two different discussion Studio pages
 * in separate browser contexts does NOT cross-contaminate
 * transcript data, panelist states, or socket connections.
 */
test.describe("Parallel discussion isolation", () => {
  test("two studios show independent mock data", async ({ browser }) => {
    /* Create two isolated contexts (simulates two users) */
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();

    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    /* Navigate both to different studio discussions */
    await page1.goto("/studio/disc-1");
    await page2.goto("/studio/disc-2");

    /* Both should render the studio layout */
    await expect(
      page1.locator("[data-testid='transcript-area']"),
    ).toBeVisible();
    await expect(
      page2.locator("[data-testid='transcript-area']"),
    ).toBeVisible();

    /* Interact with page1 — start then end discussion */
    const startBtn1 = page1.locator("text=启动讨论");
    if (await startBtn1.isVisible().catch(() => false)) {
      await startBtn1.click();
    }
    await page1.locator("text=结束讨论").click();

    /* page1 should show summary */
    await expect(page1.locator("[data-testid='summary-text']")).toBeVisible();

    /* page2 should NOT show summary (different discussion) */
    const summary2 = page2.locator("[data-testid='summary-text']");
    await expect(summary2).not.toBeVisible();

    /* page2 should still have its own start button */
    await expect(page2.locator("text=启动讨论")).toBeVisible();

    /* Clean up */
    await ctx1.close();
    await ctx2.close();
  });

  test("navigation between pages maintains isolation", async ({ page }) => {
    /* Visit studio 1 */
    await page.goto("/studio/disc-1");
    await expect(
      page.locator("[data-testid='transcript-area']"),
    ).toBeVisible();

    const startBtn = page.locator("text=启动讨论");
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
    }
    await page.locator("text=结束讨论").click();

    /* Navigate to dashboard */
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText("讨论面板");

    /* Visit a different studio — should be fresh (no summary) */
    await page.goto("/studio/disc-2");
    await expect(
      page.locator("[data-testid='transcript-area']"),
    ).toBeVisible();

    /* The summary from disc-1 should NOT appear here */
    const summary = page.locator("[data-testid='summary-text']");
    await expect(summary).not.toBeVisible();
  });
});
