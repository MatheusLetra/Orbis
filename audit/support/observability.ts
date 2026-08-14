import { expect, type Page, type TestInfo } from "@playwright/test";

export function observePage(page: Page, testInfo: TestInfo, expectedHttpStatuses: number[] = [401]) {
  const requests: Array<{ method: string; url: string; resourceType: string; status?: number }> = [];
  const requestIndexes = new WeakMap<object, number>();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("request", (request) => {
    if (["xhr", "fetch"].includes(request.resourceType())) {
      requestIndexes.set(request, requests.length);
      requests.push({ method: request.method(), url: request.url(), resourceType: request.resourceType() });
    }
  });
  page.on("response", (response) => {
    const index = requestIndexes.get(response.request());
    if (index !== undefined && requests[index]) requests[index].status = response.status();
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
    const metrics = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      },
      body: { scrollWidth: document.body.scrollWidth, clientWidth: document.body.clientWidth },
      navigation: performance.getEntriesByType("navigation").map((entry) => ({
        duration: Math.round(entry.duration),
        transferSize: "transferSize" in entry ? entry.transferSize : undefined,
      })),
    }));
    await testInfo.attach("request-manifest", {
      body: JSON.stringify(requests, null, 2),
      contentType: "application/json",
    });
    await testInfo.attach("metrics", {
      body: JSON.stringify(metrics, null, 2),
      contentType: "application/json",
    });
    await testInfo.attach("requests", {
      body: requests.map((request) => `${request.method} ${request.url} ${request.status ?? "pending"}`).join("\n"),
      contentType: "text/plain",
    });
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
