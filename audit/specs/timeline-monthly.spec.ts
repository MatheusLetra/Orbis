import { expect, test, type Locator, type Page } from "@playwright/test";
import { fixture } from "../fixtures/fixture-types";
import { login } from "../support/auth";
import { expectFocusedElementVisible, expectNoExternalOverflow, observePage } from "../support/observability";

const PERIOD = "2026-08";
const FIXED_NOW = new Date("2026-08-14T15:00:00.000Z");
const isMonthly = (url: string) => url.includes("/timeline/monthly?");

test.describe("Timeline mensal M15.1 @timeline-monthly", () => {
  test.describe.configure({ mode: "serial" });

  test("abre agosto com requisições, indicadores, isolamento e sem eager loading", async ({ page }, info) => {
    const finish = observePage(page, info);
    await prepare(page);
    const requests: string[] = [];
    page.on("request", (request) => {
      if (["fetch", "xhr"].includes(request.resourceType())) requests.push(request.url());
    });
    await openMonthly(page);
    await expect(page).toHaveURL(/\/timeline\/monthly$/);
    await expect(page.getByRole("heading", { name: /Timeline mensal/i })).toBeVisible();
    await expect(page.getByText(/agosto de 2026/i)).toBeVisible();
    for (const title of ["Mensal dentro de agosto", "Mensal atravessa meses", "Mensal atrasada", "Mensal entregue no prazo"]) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("Mensal sem datas", { exact: true })).toBeVisible();
    await expect(page.getByText("Mensal tenant B", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("region", { name: /Indicadores/i })).toContainText(/horas|entregas|atrasos/i);
    expect(requests.some(isMonthly)).toBe(true);
    expect(requests.some((url) => /attachments|time-entries|capacity/i.test(url))).toBe(false);
    await expectNoExternalOverflow(page);
    await finish();
  });

  test("navega períodos, preserva query params, filtra e mostra vazio", async ({ page }, info) => {
    const finish = observePage(page, info);
    await prepare(page);
    await openMonthly(page);
    for (const [button, period] of [["Mês anterior", "2026-07"], ["Próximo mês", PERIOD], ["Próximo mês", "2026-09"], ["Mês atual", PERIOD]]) {
      await page.getByRole("button", { name: button, exact: true }).click();
      await expect(page.getByText(formatMonth(period), { exact: true })).toBeVisible();
    }
    const filters = page.getByRole("region", { name: /Filtros da timeline mensal/i });
    const assigneeResponse = waitForMonthly(page, (url) => url.searchParams.get("assigneeId") === fixture.thirdId);
    await filters.getByRole("button", { name: "Buscar responsável" }).click();
    const lookup = page.getByRole("dialog", { name: "Buscar Responsável" });
    await lookup.getByLabel("Busca").fill("Audit Third");
    await lookup.getByRole("option", { name: "Audit Third" }).click();
    await assigneeResponse;
    await selectAndWait(page, filters.getByLabel("Status"), "IN_PROGRESS");
    const empty = waitForMonthly(page, (url) => url.searchParams.get("priority") === "LOW");
    await filters.getByLabel("Prioridade").selectOption("LOW");
    await empty;
    await expect(page.getByText(/Nenhuma requisição|Nenhum item/i)).toBeVisible();
    const filtered = waitForMonthly(page, (url) => url.searchParams.get("priority") === "HIGH");
    await filters.getByLabel("Prioridade").selectOption("HIGH");
    const url = new URL((await filtered).url());
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ period: PERIOD, assigneeId: fixture.thirdId, status: "IN_PROGRESS", priority: "HIGH" });
    await filters.getByRole("button", { name: /Limpar filtros/i }).click();
    await expect(filters.getByRole("button", { name: /Limpar filtros/i })).toBeDisabled();
    await finish();
  });

  test("recupera de 500 e 403 por retry", async ({ page }, info) => {
    const finish = observePage(page, info, [401, 403, 500]);
    await prepare(page);
    let status: 0 | 403 | 500 = 500;
    await page.route("**/timeline/monthly?**", async (route) => {
      if (status) return route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: { code: "ERROR", message: "technical detail" } }) });
      await route.fallback();
    });
    await page.goto("/timeline/monthly");
    await expect(page.getByText(/Não foi possível carregar/i)).toBeVisible();
    status = 403;
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page.getByText(/Não foi possível carregar/i)).toBeVisible();
    status = 0;
    const recovered = waitForMonthly(page);
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await recovered;
    await expect(page.getByText("Mensal dentro de agosto", { exact: true })).toBeVisible();
    await finish();
  });

  test("troca tenant, não vaza dados e mantém foco/overflow em mobile e desktop", async ({ page }, info) => {
    const finish = observePage(page, info);
    await prepare(page);
    await openMonthly(page);
    const company = page.getByRole("combobox", { name: /empresa/i });
    const tenantB = waitForMonthly(page, (url) => url.pathname.includes(fixture.companyB));
    await company.selectOption({ label: "Audit Company B" });
    await tenantB;
    await expect(page.getByText("Mensal tenant B", { exact: true })).toBeVisible();
    await expect(page.getByText("Mensal dentro de agosto", { exact: true })).toHaveCount(0);
    for (const viewport of [{ width: 320, height: 844 }, { width: 360, height: 800 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await expectNoExternalOverflow(page);
      const filters = page.getByRole("region", { name: /Filtros da timeline mensal/i });
      const priority = filters.getByLabel("Prioridade");
      await priority.focus();
      await expect(priority).toBeFocused();
      await expectFocusedElementVisible(page);
    }
    await finish();
  });
});

async function prepare(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXED_NOW);
  await login(page);
}

async function openMonthly(page: Page) {
  const response = waitForMonthly(page, (url) => url.searchParams.get("period") === PERIOD);
  await page.goto("/timeline/monthly");
  return response;
}

function waitForMonthly(page: Page, predicate?: (url: URL) => boolean) {
  return page.waitForResponse((response) => isMonthly(response.url()) && response.status() === 200 && (predicate?.(new URL(response.url())) ?? true));
}

function formatMonth(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, 1)));
}

async function selectAndWait(page: Page, locator: Locator, value: string): Promise<void> {
  const response = waitForMonthly(page);
  await locator.selectOption(value);
  await response;
}
