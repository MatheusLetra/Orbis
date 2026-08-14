import { expect, test, type Page } from "@playwright/test";
import { fixture } from "../fixtures/fixture-types";
import { login, logout } from "../support/auth";
import {
  expectFocusedElementVisible,
  expectNoExternalOverflow,
  observePage,
} from "../support/observability";

const notificationPath = /\/companies\/[^/]+\/notifications(?:[/?]|$)/;
const notificationApiPath = /\/companies\/[^/]+\/(?:notifications|notification-preferences)(?:[/?]|$)/;
const unrelatedFeaturePath = /\/(?:attachments|time-entries|capacity|timeline)(?:[/?]|$)/;

function notificationButton(page: Page) {
  return page.getByRole("button", { name: /^Notificações(?:,|$)/ });
}

async function loginThird(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(fixture.thirdEmail);
  await page.getByLabel("Senha").fill(fixture.thirdPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}

test.describe.serial("Notifications @notifications", () => {
  test("não consulta antes de abrir e carrega o centro sem recursos alheios ou transporte contínuo", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    const apiRequests: string[] = [];
    const unrelatedRequests: string[] = [];
    const continuousRequests: string[] = [];
    const sockets: string[] = [];
    page.on("request", (request) => {
      if (notificationApiPath.test(new URL(request.url()).pathname)) apiRequests.push(request.url());
      if (unrelatedFeaturePath.test(new URL(request.url()).pathname)) unrelatedRequests.push(request.url());
      if (["eventsource", "websocket"].includes(request.resourceType())) continuousRequests.push(request.url());
    });
    page.on("websocket", (socket) => sockets.push(socket.url()));

    await login(page);
    await page.goto("/kanban");
    await page.waitForTimeout(750);
    expect(apiRequests, "requests de notificação antes da abertura").toEqual([]);
    expect(continuousRequests, "EventSource/WebSocket antes da abertura").toEqual([]);
    const frontendHost = new URL(page.url()).host;
    expect(
      sockets.every((url) => new URL(url).host === frontendHost && !/notifications?/i.test(url)),
      "WebSocket de aplicação/API detectado antes da abertura",
    ).toBe(true);

    unrelatedRequests.length = 0;
    await notificationButton(page).click();
    const dialog = page.getByRole("dialog", { name: "Notificações" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Audit unread A", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Audit read A", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Conteúdo longo de notificação/)).toBeVisible();
    await expect(dialog.getByText("Não lida", { exact: true })).toHaveCount(2);
    await expect(dialog.getByRole("button", { name: "Marcar como lida" })).toHaveCount(2);
    expect(apiRequests.some((url) => notificationPath.test(new URL(url).pathname))).toBe(true);
    expect(apiRequests.some((url) => url.includes("notification-preferences"))).toBe(true);
    expect(unrelatedRequests, "recursos alheios ao abrir notificações").toEqual([]);

    const countAfterLoad = apiRequests.length;
    await page.waitForTimeout(1_000);
    expect(apiRequests, "polling detectado no centro de notificações").toHaveLength(countAfterLoad);
    expect(continuousRequests).toEqual([]);
    expect(
      sockets.every((url) => new URL(url).host === frontendHost && !/notifications?/i.test(url)),
      "WebSocket de aplicação/API detectado com o centro aberto",
    ).toBe(true);
    await expectNoExternalOverflow(page);
    await finishObservation();
  });

  test("marca unread como read e mantém item já lido", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    await login(page);
    await page.goto("/kanban");
    await notificationButton(page).click();
    const dialog = page.getByRole("dialog", { name: "Notificações" });
    const unreadItem = dialog.getByRole("listitem").filter({ hasText: "Audit unread A" });
    const readItem = dialog.getByRole("listitem").filter({ hasText: "Audit read A" });
    await expect(unreadItem.getByText("Não lida", { exact: true })).toBeVisible();
    await expect(readItem.getByText("Não lida", { exact: true })).toHaveCount(0);
    await expect(readItem.getByRole("button", { name: "Marcar como lida" })).toHaveCount(0);
    const response = page.waitForResponse(
      (candidate) => candidate.url().endsWith(`/${fixture.notificationAUnread}/read`) && candidate.status() === 200,
    );
    await unreadItem.getByRole("button", { name: "Marcar como lida" }).click();
    await response;
    await expect(unreadItem.getByText("Não lida", { exact: true })).toHaveCount(0);
    await expect(notificationButton(page)).toHaveAccessibleName("Notificações, 1 não lida");
    await finishObservation();
  });

  test("persiste preferências após fechar e recarregar", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    await login(page);
    await page.goto("/kanban");
    await notificationButton(page).click();
    const assigned = page.getByRole("checkbox", { name: "Tarefa atribuída" });
    await expect(assigned).toBeChecked();
    const disabled = page.waitForResponse(
      (response) => response.url().includes("/notification-preferences") && response.request().method() === "PATCH" && response.status() === 200,
    );
    await assigned.click();
    await disabled;
    await expect(assigned).not.toBeChecked();
    await page.keyboard.press("Escape");
    await page.reload();
    await notificationButton(page).click();
    await expect(page.getByRole("checkbox", { name: "Tarefa atribuída" })).not.toBeChecked();

    const restored = page.waitForResponse(
      (response) => response.url().includes("/notification-preferences") && response.request().method() === "PATCH" && response.status() === 200,
    );
    await page.getByRole("checkbox", { name: "Tarefa atribuída" }).click();
    await restored;
    await finishObservation();
  });

  test("exibe vazio por resposta interceptada", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    await page.route(/\/companies\/[^/]+\/notifications\?limit=20$/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], unreadCount: 0, hasMore: false }) }),
    );
    await login(page);
    await page.goto("/kanban");
    await notificationButton(page).click();
    await expect(page.getByRole("region", { name: "Nenhuma notificação" })).toBeVisible();
    await finishObservation();
  });

  test("mostra erro seguro e permite retry", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo, [401, 500]);
    let attempts = 0;
    let shouldFail = true;
    await page.route(/\/companies\/[^/]+\/notifications\?limit=20$/, async (route) => {
      attempts += 1;
      if (shouldFail) {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL", message: "segredo técnico" } }) });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], unreadCount: 0, hasMore: false }) });
      }
    });
    await login(page);
    await page.goto("/kanban");
    await notificationButton(page).click();
    await expect(page.getByText("Não foi possível carregar as notificações.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("segredo técnico")).toHaveCount(0);
    shouldFail = false;
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page.getByRole("region", { name: "Nenhuma notificação" })).toBeVisible();
    expect(attempts).toBeGreaterThanOrEqual(4);
    await finishObservation();
  });

  test("trata 403 e 404 de marcação sem expor detalhes", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo, [401, 403, 404]);
    let attempts = 0;
    await page.route(`**/notifications/${fixture.notificationALong}/read`, async (route) => {
      attempts += 1;
      const status = attempts === 1 ? 403 : 404;
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: { code: status === 403 ? "FORBIDDEN" : "NOT_FOUND", message: "detalhe interno proibido" } }) });
    });
    await login(page);
    await page.goto("/kanban");
    await notificationButton(page).click();
    const item = page.getByRole("listitem").filter({ hasText: "Audit conteúdo longo A" });
    const mark = item.getByRole("button", { name: "Marcar como lida" });
    await mark.click();
    await expect(page.getByRole("alert")).toContainText("Não foi possível marcar a notificação como lida");
    await expect(page.getByText("detalhe interno proibido")).toHaveCount(0);
    await mark.click();
    await expect.poll(() => attempts).toBe(2);
    await expect(item.getByText("Não lida", { exact: true })).toBeVisible();
    await expect(page.getByText("detalhe interno proibido")).toHaveCount(0);
    await finishObservation();
  });

  test("troca tenant sem conteúdo ou contagem stale", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    const requestedCompanies: string[] = [];
    page.on("request", (request) => {
      const match = new URL(request.url()).pathname.match(/\/companies\/([^/]+)\/(?:notifications|notification-preferences)/);
      if (match?.[1]) requestedCompanies.push(match[1]);
    });
    await login(page);
    await page.goto("/kanban");
    await notificationButton(page).click();
    await expect(page.getByText("Audit conteúdo longo A", { exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: /empresa/i }).selectOption(fixture.companyB);
    await expect(page.getByRole("dialog", { name: "Notificações" })).toHaveCount(0);
    await expect(notificationButton(page)).toHaveAccessibleName("Notificações");
    await notificationButton(page).click();
    await expect(page.getByText("Audit exclusivo tenant B", { exact: true })).toBeVisible();
    await expect(page.getByText("Audit conteúdo longo A", { exact: true })).toHaveCount(0);
    await expect(notificationButton(page)).toHaveAccessibleName("Notificações, 1 não lida");
    expect(requestedCompanies).toContain(fixture.companyA);
    expect(requestedCompanies).toContain(fixture.companyB);
    await finishObservation();
  });

  test("prende foco com Tab e ShiftTab, fecha com Escape e restaura o gatilho", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    await login(page);
    await page.goto("/kanban");
    const trigger = notificationButton(page);
    await trigger.click();
    const close = page.getByRole("button", { name: "Fechar notificações" });
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("checkbox", { name: "Release publicada" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await expectFocusedElementVisible(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Notificações" })).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await finishObservation();
  });

  for (const viewport of [
    { width: 320, height: 844 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    test(`conteúdo longo sem overflow em ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      const finishObservation = observePage(page, testInfo);
      await login(page);
      await page.goto("/kanban");
      await notificationButton(page).click();
      await expect(page.getByText(/Conteúdo longo de notificação/)).toBeVisible();
      await expectNoExternalOverflow(page);
      await finishObservation();
    });
  }

  test("gera TASK_STATUS_CHANGED por ação de Kanban alcançável e o destinatário lê pela UI", async ({ page }, testInfo) => {
    const finishActorObservation = observePage(page, testInfo);
    await login(page);
    await page.goto("/kanban");
    let changed = false;
    try {
      const task = page.getByRole("article").filter({ hasText: "Audit terceiro" });
      const transition = page.waitForResponse(
        (response) => response.url().endsWith(`/${fixture.taskThird}/status`) && response.request().method() === "PATCH" && response.status() === 200,
      );
      await task.getByRole("button", { name: "Pausar tarefa Audit terceiro" }).click();
      await transition;
      changed = true;
      await finishActorObservation();

      await logout(page);
      await page.reload();
      const finishRecipientObservation = observePage(page, testInfo);
      await loginThird(page);
      await notificationButton(page).click();
      await expect(page.getByText("Status da tarefa alterado", { exact: true })).toBeVisible();
      await expect(page.getByText("Audit terceiro", { exact: true })).toBeVisible();
      await finishRecipientObservation();
    } finally {
      if (changed) {
        const dialog = page.getByRole("dialog", { name: "Notificações" });
        if (await dialog.isVisible().catch(() => false)) await page.keyboard.press("Escape");
        await logout(page).catch(() => undefined);
        await page.reload();
        await login(page);
        await page.goto("/kanban");
        const restore = page.waitForResponse(
          (response) => response.url().endsWith(`/${fixture.taskThird}/status`) && response.request().method() === "PATCH" && response.status() === 200,
        );
        await page
          .getByRole("article")
          .filter({ hasText: "Audit terceiro" })
          .getByRole("button", { name: "Retomar tarefa Audit terceiro" })
          .click();
        await restore;
      }
    }
  });
});
