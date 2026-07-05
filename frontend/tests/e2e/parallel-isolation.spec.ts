import { test, expect } from "@playwright/test";

/**
 * E2E Scenario: Parallel Discussion Isolation
 *
 * Verifies that navigation between pages and multi-tab usage
 * does NOT cross-contaminate state.
 */
test.describe("Parallel discussion isolation", () => {
  test("two browser contexts show independent pages", async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();

    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    /* Navigate both to different pages */
    await page1.goto("/dashboard");
    await page2.goto("/setup/new");

    /* Both pages should render independently */
    await expect(page1.locator("h1")).toContainText("讨论面板");
    await expect(page2.locator("h1")).toContainText("创建新讨论");

    /* Clean up */
    await ctx1.close();
    await ctx2.close();
  });

  test("navigation between pages maintains isolation", async ({ page }) => {
    /* Visit setup */
    await page.goto("/setup/new");
    await expect(page.locator("h1")).toBeVisible();

    /* Navigate to dashboard */
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText("讨论面板");

    /* Visit another setup — should be fresh */
    await page.goto("/setup/new");
    await expect(page.locator('input[type="text"]')).toBeVisible();

    /* No residual state from previous pages */
    const input = page.locator('input[type="text"]');
    await expect(input).toHaveValue("");
  });
});
