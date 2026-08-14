import type { Page } from "@playwright/test";
import { fixture } from "../fixtures/fixture-types";

export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(fixture.actorEmail);
  await page.getByLabel("Senha").fill(fixture.actorPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
  const companyButton = page.getByRole("button", { name: "Audit Company A" });
  if (await companyButton.isVisible().catch(() => false)) await companyButton.click();
  await page.getByRole("combobox", { name: /empresa/i }).selectOption({ label: "Audit Company A" }).catch(() => undefined);
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Sair|Logout/i }).click();
  await page.waitForURL("**/login");
}
