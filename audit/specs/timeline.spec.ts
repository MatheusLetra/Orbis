import { expect, test, type Locator, type Page } from "@playwright/test";
import { fixture } from "../fixtures/fixture-types";
import { login } from "../support/auth";
import {
  expectFocusedElementVisible,
  expectNoExternalOverflow,
  observePage,
} from "../support/observability";

const CURRENT_WEEK = "2026-08-10";
const FIXED_NOW = new Date("2026-08-14T15:00:00.000Z");
const timelineRequest = (url: string) => url.includes("/timeline/weekly?");

test.describe("Timeline M14.1 @timeline", () => {
  test.describe.configure({ mode: "serial" });

  test("autentica, abre a semana atual e classifica as fixtures sem eager loading", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    await prepare(page);
    const requests: string[] = [];
    page.on("request", (request) => {
      if (["fetch", "xhr"].includes(request.resourceType())) requests.push(request.url());
    });

    await openTimeline(page);
    await expect(page).toHaveURL(/\/timeline$/);
    await expect(page.getByRole("heading", { name: "Timeline semanal" })).toBeVisible();
    await expect(page.getByText(/10 de ago.*16 de ago/i)).toBeVisible();
    await expect(page.getByText("Timeline dentro da semana", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Timeline atravessa início e fim", { exact: true })).toHaveCount(5);
    await expect(page.getByRole("article", { name: /Timeline pausada, Pausada/ })).toHaveCount(2);
    await expect(page.getByLabel("Tarefa pausada")).toHaveCount(2);
    await expect(page.getByRole("article", { name: /Timeline concluída, Concluída/ })).toHaveCount(2);

    const overdue = page.getByRole("region", { name: "Em atraso" });
    const overdueCard = overdue.getByRole("article", { name: /Timeline atrasada anterior/ });
    await expect(overdueCard).toBeVisible();
    await expect(overdueCard.getByText("Em atraso", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Sem data" }).getByText("Timeline sem data")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Fim de semana" }).getByText("Timeline somente fim de semana"),
    ).toBeVisible();
    await expect(page.getByText("Timeline fora da semana")).toHaveCount(0);
    await expect(page.getByText("Timeline cross-tenant B")).toHaveCount(0);
    expect(requests.filter(timelineRequest).length).toBeGreaterThan(0);
    expect(requests.some((url) => /attachments|time-entries|capacity/i.test(url))).toBe(false);
    await expectNoExternalOverflow(page);
    await finishObservation();
  });

  test("navega entre semanas, aplica query params, limpa filtros e mostra vazio", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    await prepare(page);
    await openTimeline(page);

    await clickAndWaitForWeek(page, "Semana anterior", "2026-08-03");
    await clickAndWaitForWeek(page, "Próxima semana", CURRENT_WEEK);
    await clickAndWaitForWeek(page, "Próxima semana", "2026-08-17");
    await clickAndWaitForWeek(page, "Semana atual", CURRENT_WEEK);

    const filters = page.getByRole("region", { name: "Filtros da timeline" });
    await selectAndWait(page, filters.getByLabel("Responsável"), fixture.thirdId);
    await selectAndWait(page, filters.getByLabel("Status"), "PAUSED");
    const emptyResponse = waitForTimelineResponse(page, (url) => url.searchParams.get("priority") === "LOW");
    await filters.getByLabel("Prioridade").selectOption("LOW");
    await emptyResponse;
    await expect(page.getByRole("heading", { name: "Nenhuma tarefa nesta semana" })).toBeVisible();

    const filteredResponse = waitForTimelineResponse(page, (url) => url.searchParams.get("priority") === "HIGH");
    await filters.getByLabel("Prioridade").selectOption("HIGH");
    const filteredUrl = new URL((await filteredResponse).url());
    expect(Object.fromEntries(filteredUrl.searchParams)).toMatchObject({
      weekStart: CURRENT_WEEK,
      assigneeId: fixture.thirdId,
      status: "PAUSED",
      priority: "HIGH",
    });
    await expect(page.getByText("Timeline pausada", { exact: true })).toHaveCount(2);

    await filters.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(filters.getByRole("button", { name: "Limpar filtros" })).toBeDisabled();
    await expect(page.getByText("Timeline dentro da semana", { exact: true })).toBeVisible();
    await finishObservation();
  });

  test("trata erro 500, expõe retry e recupera", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo, [401, 500]);
    await prepare(page);
    let shouldFail = true;
    let failures = 0;
    await page.route("**/timeline/weekly?**", async (route) => {
      if (shouldFail) {
        failures += 1;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "technical detail" } }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto("/timeline");
    await expect(page.getByText("Não foi possível carregar a timeline.")).toBeVisible({ timeout: 15_000 });
    shouldFail = false;
    const recovered = waitForTimelineResponse(page, undefined, 200);
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await recovered;
    await expect(page.getByText("Timeline dentro da semana", { exact: true })).toBeVisible();
    expect(failures).toBeGreaterThanOrEqual(3);
    await finishObservation();
  });

  test("trata 403, observa capabilities quando requisitada e recupera", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo, [401, 403]);
    await prepare(page);
    const capabilityResponses: Array<{ url: string; status: number }> = [];
    page.on("response", (response) => {
      if (response.url().includes("/capabilities")) {
        capabilityResponses.push({ url: response.url(), status: response.status() });
      }
    });
    let forbidden = true;
    await page.route("**/timeline/weekly?**", async (route) => {
      if (forbidden) {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "FORBIDDEN", message: "technical detail" } }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto("/timeline");
    await expect(page.getByText("Não foi possível carregar a timeline.")).toBeVisible();
    forbidden = false;
    const recovered = waitForTimelineResponse(page, undefined, 200);
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await recovered;
    await expect(page.getByText("Timeline dentro da semana", { exact: true })).toBeVisible();
    expect(capabilityResponses.every((response) => response.status === 200)).toBe(true);
    await testInfo.attach("capabilities-observation", {
      body: JSON.stringify(capabilityResponses, null, 2),
      contentType: "application/json",
    });
    await finishObservation();
  });

  test("isola tenant ao trocar empresa e não vaza cross-tenant", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    await prepare(page);
    await openTimeline(page);
    const company = page.getByRole("combobox", { name: /empresa/i });

    const tenantB = waitForTimelineResponse(page, (url) => url.pathname.includes(fixture.companyB));
    await company.selectOption({ label: "Audit Company B" });
    await tenantB;
    await expect(page.getByText("Timeline cross-tenant B", { exact: true })).toHaveCount(2);
    await expect(page.getByText("Timeline dentro da semana")).toHaveCount(0);

    await company.selectOption({ label: "Audit Company A" });
    await expect(page.getByText("Timeline dentro da semana", { exact: true })).toBeVisible();
    await expect(page.getByText("Timeline cross-tenant B")).toHaveCount(0);
    await finishObservation();
  });

  test("ignora resposta stale na troca rápida e mantém teclado e foco", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    await prepare(page);
    const initial = await openTimeline(page);
    const current = (await initial.json()) as WeeklyPayload;
    const sample = current.days.flatMap((day) => day.tasks)[0];
    if (!sample) throw new Error("Resposta semanal sem tarefa para simular stale response");
    const stale = {
      ...current,
      weekStart: "2026-08-03",
      weekEnd: "2026-08-09",
      days: ["03", "04", "05", "06", "07"].map((day, index) => ({
        date: `2026-08-${day}`,
        isBusinessDay: true,
        tasks: index === 0 ? [{ ...sample, id: "00000000-0000-4000-8000-000000000999", title: "RESPOSTA STALE" }] : [],
      })),
      overdueTasks: [],
      weekendTasks: [],
      undatedTasks: [],
    };
    await page.route("**/timeline/weekly?**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("weekStart") !== "2026-08-03") return route.fallback();
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route
        .fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stale) })
        .catch(() => undefined);
    });

    await page.getByRole("button", { name: "Semana anterior" }).click();
    await page.getByRole("button", { name: "Próxima semana" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/10 de ago.*16 de ago/i)).toBeVisible();
    await expect(page.getByText("RESPOSTA STALE")).toHaveCount(0);

    const next = page.getByRole("button", { name: "Próxima semana" });
    await next.focus();
    await expect(next).toBeFocused();
    await expectFocusedElementVisible(page);
    const nextWeek = waitForTimelineResponse(page, (url) => url.searchParams.get("weekStart") === "2026-08-17");
    await next.press("Enter");
    await nextWeek;
    await expect(next).toBeFocused();
    await expectFocusedElementVisible(page);
    await finishObservation();
  });

  test("mantém overflow interno e nenhum overflow externo nos quatro viewports", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    await prepare(page);
    await openTimeline(page);
    const viewports = [
      { width: 320, height: 844 },
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ];
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expectNoExternalOverflow(page);
      const metrics = await page
        .getByRole("region", { name: /Grade da timeline semanal/ })
        .evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
      if (viewport.width < 980) expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
      await page.getByLabel("Status").focus();
      await expectFocusedElementVisible(page);
      await testInfo.attach(`viewport-${viewport.width}x${viewport.height}`, {
        body: JSON.stringify({ viewport, timeline: metrics }, null, 2),
        contentType: "application/json",
      });
    }
    await finishObservation();
  });

  test("sincroniza mutação real do Kanban com a Timeline e restaura a fixture", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    await prepare(page);
    let changed = false;
    try {
      await page.goto("/kanban");
      await changePriority(page, "LOW");
      changed = true;
      const timeline = waitForTimelineResponse(page);
      await page.goto("/timeline");
      await timeline;
      await expect(
        page.getByRole("article", { name: /Timeline dentro da semana, A fazer, prioridade Baixa/ }),
      ).toBeVisible();
    } finally {
      if (changed) {
        await page.goto("/kanban");
        await changePriority(page, "MEDIUM");
      }
    }
    await finishObservation();
  });
});

async function prepare(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXED_NOW);
  await login(page);
}

async function openTimeline(page: Page) {
  const response = waitForTimelineResponse(page, (url) => url.searchParams.get("weekStart") === CURRENT_WEEK);
  await page.goto("/timeline");
  return response;
}

function waitForTimelineResponse(page: Page, predicate?: (url: URL) => boolean, status = 200) {
  return page.waitForResponse((response) => {
    if (!timelineRequest(response.url()) || response.status() !== status) return false;
    return predicate?.(new URL(response.url())) ?? true;
  });
}

async function clickAndWaitForWeek(page: Page, button: string, weekStart: string): Promise<void> {
  await page.getByRole("button", { name: button, exact: true }).click();
  await expect(page.getByText(formatWeekRange(weekStart), { exact: true })).toBeVisible();
}

function formatWeekRange(weekStart: string): string {
  const format = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)));
  };
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() + 6);
  return `${format(weekStart)} a ${format(start.toISOString().slice(0, 10))}`;
}

async function selectAndWait(page: Page, locator: Locator, value: string): Promise<void> {
  const response = waitForTimelineResponse(page);
  await locator.selectOption(value);
  await response;
}

async function changePriority(page: Page, priority: "LOW" | "MEDIUM"): Promise<void> {
  const card = page.getByRole("article").filter({ hasText: "Timeline dentro da semana" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: /Editar tarefa Timeline dentro da semana/ }).click();
  const dialog = page.getByRole("dialog", { name: "Editar tarefa" });
  await dialog.getByLabel("Prioridade").selectOption(priority);
  const updated = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().includes(`/tasks/${fixture.timelineInside}`) &&
      response.status() === 200,
  );
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await updated;
  await expect(dialog).toHaveCount(0);
}

interface WeeklyPayload {
  companyId: string;
  weekStart: string;
  weekEnd: string;
  days: Array<{ date: string; isBusinessDay: true; tasks: Array<Record<string, unknown>> }>;
  overdueTasks: Array<Record<string, unknown>>;
  weekendTasks: Array<Record<string, unknown>>;
  undatedTasks: Array<Record<string, unknown>>;
  assignees: Array<Record<string, unknown>>;
}
