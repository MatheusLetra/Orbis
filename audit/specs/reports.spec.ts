import { expect, test } from "@playwright/test";
import { fixture } from "../fixtures/fixture-types";
import { login } from "../support/auth";
import { expectNoExternalOverflow, observePage } from "../support/observability";

test.describe("Relatórios M18 @reports", () => {
  test.describe.configure({ mode: "serial" });

  test("abre, filtra, pagina e exporta CSV sem vazar tenant", async ({ page }, info) => {
    const finish = observePage(page, info);
    await login(page);
    const report = page.waitForResponse((response) => response.url().includes(`/companies/${fixture.companyA}/reports/tasks?`) && response.status() === 200);
    await page.goto("/reports");
    await report;
    await expect(page.getByRole("heading", { name: "Relatório de Tasks" })).toBeVisible();
    await expect(page.getByText(/Task/).first()).toBeVisible();
    const filters = page.getByRole("region", { name: "Filtros do relatório" });
    await filters.getByLabel("Status").selectOption("DONE");
    await page.waitForResponse((response) => response.url().includes("/reports/tasks?") && response.url().includes("status=DONE") && response.status() === 200);
    await expect(filters.getByRole("button", { name: /Limpar filtros/i })).toBeEnabled();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Exportar CSV/i }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/orbis-task-report-.*\.csv$/);
    expect(await file.createReadStream()).toBeTruthy();
    await page.getByRole("combobox", { name: /empresa/i }).selectOption(fixture.companyB);
    await expect(page.getByText("Relatório de Tasks")).toBeVisible();
    await expectNoExternalOverflow(page);
    await finish();
  });

  for (const viewport of [{ width: 320, height: 844 }, { width: 360, height: 800 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    test(`não cria overflow em ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
      const finish = observePage(page, info);
      await page.setViewportSize(viewport);
      await login(page);
      await page.goto("/reports");
      await expect(page.getByRole("heading", { name: "Relatório de Tasks" })).toBeVisible();
      await expectNoExternalOverflow(page);
      await finish();
    });
  }
});
