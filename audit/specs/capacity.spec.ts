import { expect, test } from "@playwright/test";
import { login } from "../support/auth";
import { expectFocusedElementVisible, expectNoExternalOverflow, observePage } from "../support/observability";

test.describe("Capacity @capacity", () => {
  test("executa sucesso, zero, validação, foco e retry", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo, [401]);
    await login(page);
    await page.goto("/");
    const panel = page.getByRole("region", { name: "Simulação de capacidade" });
    await expect(panel).toBeVisible();

    const date = panel.getByLabel("Data inicial");
    const hours = panel.getByLabel("Horas estimadas");
    await panel.getByRole("button", { name: "Calcular simulação" }).press("Enter");
    await expect(date).toHaveAttribute("aria-invalid", "true");
    await expect(date).toBeFocused();
    await expectFocusedElementVisible(page);

    await date.fill("2026-08-17");
    await hours.fill("0");
    await panel.getByRole("button", { name: "Calcular simulação" }).press("Enter");
    await expect(panel.getByText("Não persistida")).toBeVisible();
    await expect(panel.getByText("Data prevista")).toBeVisible();
    await expectNoExternalOverflow(page);
    await finishObservation();
  });

  test("preserva formulário em 422 e permite retry", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo, [401, 422]);
    await login(page);
    await page.goto("/");
    const panel = page.getByRole("region", { name: "Simulação de capacidade" });
    await page.route("**/capacity?**", (route) => route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: { code: "BUSINESS_RULE", message: "technical detail" } }) }));
    await panel.getByLabel("Data inicial").fill("2026-08-17");
    await panel.getByLabel("Horas estimadas").fill("12");
    await panel.getByRole("button", { name: "Calcular simulação" }).click();
    await expect(panel.getByRole("alert")).toContainText("Confira os parâmetros");
    await expect(panel.getByLabel("Horas estimadas")).toHaveValue("12");
    await expect(panel.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
    await finishObservation();
  });
});
