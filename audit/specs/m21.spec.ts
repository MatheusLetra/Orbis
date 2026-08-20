import { expect, test } from "@playwright/test";
import { fixture } from "../fixtures/fixture-types";
import { login } from "../support/auth";

test.describe("@m21 superfícies administrativas", () => {
  test("navega pelas telas administrativas, dialogs e estados móveis", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !message.text().includes("Failed to load resource: the server responded with a status of 401")
      )
        errors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() === 401 && !response.url().endsWith("/auth/refresh"))
        errors.push(`401 ${response.url()}`);
    });
    await login(page);

    let firstViewport = true;
    for (const viewport of [
      { width: 320, height: 844 },
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      if (firstViewport) {
        await page.goto("/admin/companies");
        firstViewport = false;
      } else {
        const link = page.getByRole("link", { name: "Empresas" });
        await link.evaluate((element) => (element as HTMLElement).click());
      }
      await expect(page.getByRole("heading", { name: "Empresas" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Nova empresa" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Capacidade" })).toBeVisible();
      await page.getByRole("button", { name: "Capacidade" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);

      const usersLink = page.getByRole("link", { name: "Usuários" });
      await usersLink.evaluate((element) => (element as HTMLElement).click());
      await expect(page.getByRole("heading", { name: "Usuários" })).toBeVisible();
      await page.getByRole("button", { name: "Permissões" }).first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Escape");

      const systemsLink = page.getByRole("link", { name: "Sistemas" });
      await systemsLink.evaluate((element) => (element as HTMLElement).click());
      await expect(page.getByRole("heading", { name: "Sistemas e versões" })).toBeVisible();
      await page.getByRole("button", { name: "Versões" }).first().click();
      await expect(page.getByText("20.0.0")).toBeVisible();

      const releasesLink = page.getByRole("link", { name: "Releases" });
      await releasesLink.evaluate((element) => (element as HTMLElement).click());
      await expect(page.getByRole("heading", { name: "Releases" })).toBeVisible();
      await expect(page.getByText(/somente texto/i)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
        true,
      );
    }
    expect(errors).toEqual([]);
  });

  test("usuário sem capability administrativa não acessa as superfícies", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(fixture.thirdEmail);
    await page.getByLabel("Senha").fill(fixture.thirdPassword);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL((url) => url.pathname !== "/login");
    await page.goto("/admin/users");
    await expect(page.getByRole("alert")).toContainText("acesso administrativo");
    await expect(page.getByRole("button", { name: "Novo membro" })).toHaveCount(0);
  });

  test("não existe download binário de release no contrato HTTP", async ({ request }) => {
    const response = await request.get(`${process.env.AUDIT_API_URL}/reference/openapi.json`);
    expect(response.ok()).toBeTruthy();
    const paths = Object.keys((await response.json()).paths as Record<string, unknown>);
    expect(paths.some((path) => path.includes("release") && path.includes("download"))).toBeFalsy();
  });
});
