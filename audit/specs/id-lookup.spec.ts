import { expect, test } from "@playwright/test";
import { login } from "../support/auth";

for (const viewport of [
  { width: 320, height: 844 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`lookup de membro em ${viewport.width}x${viewport.height} @id-lookup`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await login(page);
    await page.goto("/kanban");
    await page.getByRole("button", { name: "Nova tarefa" }).click();
    const taskDialog = page.getByRole("dialog", { name: "Nova tarefa" });
    await taskDialog.getByRole("button", { name: "Buscar responsável" }).click();

    const lookupDialog = page.getByRole("dialog", { name: "Buscar Responsável" });
    await expect(lookupDialog.getByLabel("Busca")).toBeFocused();
    await lookupDialog.getByLabel("Busca").fill("Audit Developer");
    await expect(lookupDialog.getByRole("option", { name: "Audit Developer" })).toBeVisible();
    await lookupDialog.getByRole("option", { name: "Audit Developer" }).click();

    await expect(taskDialog.getByText("Selecionado: Audit Developer")).toBeVisible();
    await taskDialog.getByRole("button", { name: "Limpar responsável" }).click();
    await expect(taskDialog.getByText("Nenhum registro selecionado").first()).toBeVisible();

    await taskDialog.getByRole("button", { name: "Buscar responsável" }).click();
    await page.getByRole("dialog", { name: "Buscar Responsável" }).getByLabel("Busca").press("Escape");
    await expect(page.getByRole("dialog", { name: "Nova tarefa" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
      true,
    );
  });
}
