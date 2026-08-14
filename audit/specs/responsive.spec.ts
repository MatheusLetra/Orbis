import { expect, test } from "@playwright/test";
import { login } from "../support/auth";
import { expectFocusedElementVisible, expectNoExternalOverflow, observePage } from "../support/observability";

for (const viewport of [
  { width: 320, height: 844 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`estrutura responsiva ${viewport.width}x${viewport.height} @responsive`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const finishObservation = observePage(page, testInfo);
    await login(page);
    await page.goto("/");
    await expectNoExternalOverflow(page);
    await expectFocusedElementVisible(page);
    await expect(page.getByRole("heading", { name: "Simulação de capacidade" })).toBeVisible();
    const viewportMetrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    expect(viewportMetrics.width).toBe(viewport.width);
    await finishObservation();
  });
}
