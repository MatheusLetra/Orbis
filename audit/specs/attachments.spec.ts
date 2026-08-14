import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { fixtureFile, secondFixtureFile } from "../fixtures/fixture-types";
import { login } from "../support/auth";
import { expectNoExternalOverflow, observePage } from "../support/observability";

test.describe("Attachments @attachments", () => {
  test("não lista anexos antes do detalhe e lista metadados depois", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    const attachmentRequests: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "fetch" && request.url().includes("/attachments")) attachmentRequests.push(request.url());
    });
    await login(page);
    await page.goto("/kanban");
    await page.waitForTimeout(500);
    expect(attachmentRequests).toEqual([]);
    attachmentRequests.length = 0;
    const card = page.getByRole("article").filter({ hasText: "Audit própria" });
    await card.getByRole("button", { name: /Ver detalhes/ }).click();
    await expect(page.getByText("Arquivo de auditoria", { exact: true })).toBeVisible();
    await expect(page.getByText("Documentação externa")).toBeVisible();
    expect(attachmentRequests.some((url) => url.endsWith("/attachments"))).toBe(true);
    await expectNoExternalOverflow(page);
    await finishObservation();
  });

  test("download FILE exige ação explícita e preserva metadados", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    const fileRequests: Array<{ authorization: string | undefined; status?: number }> = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/file")) {
        fileRequests.push({ authorization: request.headers().authorization });
      }
    });
    page.on("response", (response) => {
      if (response.url().endsWith("/file")) {
        const request = fileRequests.at(-1);
        if (request) request.status = response.status();
      }
    });
    await login(page);
    await page.goto("/kanban");
    const card = page.getByRole("article").filter({ hasText: "Audit própria" });
    await card.getByRole("button", { name: /Ver detalhes/ }).click();
    const buttons = page.getByRole("button", { name: "Baixar arquivo" });
    await expect(buttons).toHaveCount(2);
    const downloadPromise = page.waitForEvent("download");
    const responsePromise = page.waitForResponse(
      (response) => response.url().endsWith(`/${"00000000-0000-4000-8000-000000000201"}/file`),
    );
    await buttons.first().click();
    const binaryResponse = await responsePromise;
    expect(binaryResponse.status()).toBe(200);
    expect(await binaryResponse.body()).toEqual(fixtureFile);
    await expect(buttons.first()).toHaveText("Baixar arquivo");
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("audit-file.pdf");
    const path = await download.path();
    if (!path) throw new Error("Download sem arquivo local");
    const bytes = await readFile(path);
    expect(bytes).toEqual(fixtureFile);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      createHash("sha256").update(fixtureFile).digest("hex"),
    );
    await expect(buttons.first()).toHaveText("Baixar arquivo");
    expect(fileRequests).toHaveLength(1);
    expect(fileRequests[0]?.authorization).toMatch(/^Bearer /);
    expect(fileRequests[0]?.status).toBe(200);

    const secondDownloadPromise = page.waitForEvent("download");
    await buttons.nth(1).click();
    const secondDownload = await secondDownloadPromise;
    expect(secondDownload.suggestedFilename()).toBe("audit-file-2.pdf");
    const secondPath = await secondDownload.path();
    if (!secondPath) throw new Error("Segundo download sem arquivo local");
    expect(await readFile(secondPath)).toEqual(secondFixtureFile);
    expect(fileRequests).toHaveLength(2);

    const linkItem = page.getByRole("listitem").filter({ hasText: "Documentação externa" });
    await expect(linkItem.getByRole("link")).toHaveAttribute("href", "https://example.com/orbis-audit");
    await expect(linkItem.getByRole("button", { name: "Baixar arquivo" })).toHaveCount(0);
    await finishObservation();
  });

  test("troca de tenant isola attachments e remoção continua funcional", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    await login(page);
    await page.goto("/kanban");
    const card = page.getByRole("article").filter({ hasText: "Audit própria" });
    await card.getByRole("button", { name: /Ver detalhes/ }).click();
    await expect(page.getByText("Arquivo de auditoria", { exact: true })).toBeVisible();
    const linkItem = page.getByRole("listitem").filter({ hasText: "Documentação externa" });
    await linkItem.getByRole("button", { name: "Remover attachment" }).click();
    await page
      .getByRole("dialog", { name: "Remover attachment?" })
      .getByRole("button", { name: "Remover" })
      .click();
    await expect(page.getByText("Documentação externa", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Fechar" }).click();
    await page.getByRole("combobox", { name: /empresa/i }).selectOption({ label: "Audit Company B" });
    await expect(page.getByRole("heading", { name: "Tenant B exclusivo" })).toBeVisible();
    await expect(page.getByText("Audit própria")).toHaveCount(0);
    await page.getByRole("combobox", { name: /empresa/i }).selectOption({ label: "Audit Company A" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: /Ver detalhes/ }).click();
    await expect(page.getByText("Arquivo de auditoria", { exact: true })).toBeVisible();
    await finishObservation();
  });
});
