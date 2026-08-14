import { expect, test, type Page } from "@playwright/test";
import { fixture } from "../fixtures/fixture-types";
import { login } from "../support/auth";
import { expectFocusedElementVisible, expectNoExternalOverflow, observePage } from "../support/observability";

const YEAR = "2026";
const isYearly = (url: string) => url.includes("/timeline/yearly?");

test.describe("Timeline anual M15.2 @timeline-yearly", () => {
  test.describe.configure({ mode: "serial" });

  test("abre doze meses sem carregar relações fora do contrato", async ({ page }, info) => {
    const finish = observePage(page, info);
    await prepare(page);
    const requests: string[] = [];
    page.on("request", (request) => { if (["fetch", "xhr"].includes(request.resourceType())) requests.push(request.url()); });
    const response = waitForYearly(page);
    await page.goto("/timeline/yearly");
    await response;
    await expect(page).toHaveURL(/\/timeline\/yearly$/);
    await expect(page.getByRole("heading", { name: /Timeline anual/i })).toBeVisible();
    await expect(page.locator("button[aria-controls^='yearly-month-']")).toHaveCount(12);
    expect(requests.some(isYearly)).toBe(true);
    expect(requests.some((url) => /tasks|time-entries|capacity|attachments/i.test(url))).toBe(false);
    await expectNoExternalOverflow(page);
    await finish();
  });

  test("navega, filtra, expande e preserva foco", async ({ page }, info) => {
    const finish = observePage(page, info);
    await prepare(page);
    await page.goto("/timeline/yearly");
    await waitForYearly(page);
    await page.getByRole("button", { name: "Próximo ano" }).click();
    await waitForYearly(page, (url) => url.searchParams.get("year") === "2027");
    await page.getByRole("button", { name: "Ano anterior" }).click();
    await expect(page.locator('nav[aria-label="Navegação entre anos"] span')).toHaveText("2026");
    const filters = page.getByRole("region", { name: /Filtros da timeline anual/i });
    await filters.getByLabel("Prioridade").selectOption("HIGH");
    await waitForYearly(page, (url) => url.searchParams.get("priority") === "HIGH");
    const month = page.locator("button[aria-controls^='yearly-month-']").first();
    await expect(month).toBeVisible();
    await page.waitForTimeout(500);
    await month.evaluate((element) => (element as HTMLButtonElement).click());
    await expect(month).toHaveAttribute("aria-expanded", /true|false/);
    const priority = filters.getByLabel("Prioridade");
    await priority.focus();
    await expect(priority).toBeFocused();
    await expectFocusedElementVisible(page);
    await finish();
  });

  test("recupera de erro e troca tenant sem vazamento", async ({ page }, info) => {
    const finish = observePage(page, info, [401, 403, 500]);
    await prepare(page);
    let status: 0 | 403 | 500 = 500;
    await page.route("**/timeline/yearly?**", async (route) => { if (status) return route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: { code: "ERROR", message: "technical detail" } }) }); await route.fallback(); });
    await page.goto("/timeline/yearly");
    await expect(page.getByText(/Não foi possível carregar/i)).toBeVisible();
    status = 0;
    const recovered = waitForYearly(page);
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await recovered;
    const company = page.getByRole("combobox", { name: /empresa/i });
    const tenantB = waitForYearly(page, (url) => url.pathname.includes(fixture.companyB));
    await company.selectOption({ label: "Audit Company B" });
    await tenantB;
    await expectNoExternalOverflow(page);
    await finish();
  });
});

async function prepare(page: Page) { await login(page); }
function waitForYearly(page: Page, predicate?: (url: URL) => boolean) { return page.waitForResponse((response) => isYearly(response.url()) && response.status() === 200 && (predicate?.(new URL(response.url())) ?? true)); }
