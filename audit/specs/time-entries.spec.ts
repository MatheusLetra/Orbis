import { expect, test } from "@playwright/test";
import { login } from "../support/auth";
import { expectNoExternalOverflow, observePage } from "../support/observability";

test.describe("TimeEntry @time-entries", () => {
  test("abre o detalhe e exibe lista e total", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo, [401, 500]);
    await login(page);
    await page.goto("/kanban");
    const card = page.getByRole("article").filter({ hasText: "Audit própria" });
    await card.getByRole("button", { name: /Ver detalhes/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Horas apontadas" })).toBeVisible();
    await page.getByRole("heading", { name: "Horas apontadas" }).scrollIntoViewIfNeeded();
    await expect(page.getByText(/75/)).toBeVisible();
    await expectNoExternalOverflow(page);
    await finishObservation();
  });

  test("mantém o formulário após erro e permite retry", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo, [401, 500]);
    await login(page);
    await page.goto("/kanban");
    const card = page.getByRole("article").filter({ hasText: "Audit própria" });
    await card.getByRole("button", { name: /Ver detalhes/ }).click();
    await page.getByRole("button", { name: /Registrar horas na tarefa/ }).click();
    const dialog = page.getByRole("dialog", { name: "Registrar horas" });
    await dialog.getByLabel(/Duração/).fill("20");
    await page.route("**/time-entries", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "technical detail" } }) }));
    await dialog.getByRole("button", { name: "Registrar horas" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByLabel(/Duração/)).toHaveValue("20");
    await finishObservation();
  });
});
