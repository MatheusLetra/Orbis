import { expect, type Page, type TestInfo } from "@playwright/test";

export function observePage(page: Page, testInfo: TestInfo, expectedHttpStatuses: number[] = [401]) {
  const requests: string[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("request", (request) => {
    if (["xhr", "fetch"].includes(request.resourceType())) requests.push(`${request.method()} ${request.url()}`);
  });
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("favicon.ico") &&
      !expectedHttpStatuses.some((status) => message.text().includes(`status of ${status}`))
    ) consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return async () => {
    await testInfo.attach("requests", { body: requests.join("\n"), contentType: "text/plain" });
    await testInfo.attach("console-errors", { body: consoleErrors.join("\n") || "none", contentType: "text/plain" });
    await testInfo.attach("page-errors", { body: pageErrors.join("\n") || "none", contentType: "text/plain" });
    expect(consoleErrors, "console errors inesperados").toEqual([]);
    expect(pageErrors, "page errors inesperados").toEqual([]);
  };
}

export async function expectNoExternalOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
  }));
  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.documentClientWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.bodyClientWidth + 1);
}

export async function expectFocusedElementVisible(page: Page): Promise<void> {
  const visible = await page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.left >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth;
  });
  expect(visible).toBe(true);
}
