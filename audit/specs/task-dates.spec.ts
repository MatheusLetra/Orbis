import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import postgres from "postgres";
import { fixture } from "../fixtures/fixture-types";
import { login } from "../support/auth";

test.use({ trace: "off", screenshot: "off", video: "off" });

test.describe("@task-dates criação real de datas de Task", () => {
  test("registra datas no Kanban e dentro de Requisition", async ({ page }) => {
    test.setTimeout(60_000);
    const records: Record<string, unknown>[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !message.text().includes("Failed to load resource: the server responded with a status of 401")
      )
        consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/tasks")) {
        records.push({ kind: "request", url: request.url(), body: request.postDataJSON() });
      }
    });
    page.on("response", async (response) => {
      if (response.url().includes("/tasks")) {
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          body = await response.text().catch(() => null);
        }
        records.push({ kind: "response", url: response.url(), status: response.status(), body });
      }
    });

    await page.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
    await login(page);

    const createAndInspect = async (title: string, requisition: boolean) => {
      await page.goto(requisition ? "/admin/requisitions" : "/kanban");
      if (requisition) {
        const card = page.locator("article").filter({ hasText: "#201 Mensal dentro de agosto" });
        await card.getByRole("button", { name: "Detalhes" }).click();
        await page.getByRole("button", { name: "Cancelar" }).click();
        await page.locator("button").filter({ hasText: "Adicionar tarefa" }).first().click();
      } else {
        await page.getByRole("button", { name: "Nova tarefa" }).click();
      }
      const dialog = page.getByRole("dialog", { name: "Nova tarefa" });
      const start = dialog.getByLabel("Data de início");
      const end = dialog.getByLabel("Previsão de término");
      expect(await start.getAttribute("type")).toBe("date");
      expect(await end.getAttribute("type")).toBe("date");
      expect(await start.getAttribute("name")).toBeNull();
      expect(await end.getAttribute("name")).toBeNull();
      await dialog.getByLabel("Título").fill(title);
      await start.fill("2026-08-20");
      await end.fill("2026-08-25");
      records.push({
        kind: "dom",
        title,
        requisition,
        startValue: await start.inputValue(),
        endValue: await end.inputValue(),
        startOuterHTML: await start.evaluate((element) => element.outerHTML),
        endOuterHTML: await end.evaluate((element) => element.outerHTML),
      });
      const responsePromise = page.waitForResponse(
        (response) => response.request().method() === "POST" && response.url().includes("/tasks"),
      );
      await dialog.getByRole("button", { name: "Criar tarefa" }).click();
      const response = await responsePromise;
      const created = await response.json();
      records.push({ kind: "created", title, status: response.status(), body: created });
      if (requisition) await page.goto("/kanban");
      await expect(page.getByText(title, { exact: true })).toBeVisible();
      const card = page.locator("article").filter({ hasText: title }).first();
      await expect(card).toContainText("20/08/2026");
      await expect(card).toContainText("25/08/2026");
      await card.getByRole("button", { name: `Ver detalhes da tarefa ${title}` }).click();
      const detail = page.getByRole("dialog", { name: "Detalhes da tarefa" });
      await expect(detail).toContainText("20/08/2026");
      await expect(detail).toContainText("25/08/2026");
      records.push({ kind: "ui", title, card: await card.innerText(), detail: await detail.innerText() });
      await page.keyboard.press("Escape");
      return created.id as string;
    };

    const kanbanTitle = `Browser dates Kanban ${Date.now()}`;
    const requisitionTitle = `Browser dates Requisition ${Date.now()}`;
    const kanbanId = await createAndInspect(kanbanTitle, false);
    const requisitionId = await createAndInspect(requisitionTitle, true);

    const sql = postgres(process.env.AUDIT_DATABASE_URL!, { max: 1, prepare: false });
    const rows = await sql<{
      id: string;
      title: string;
      start_date: string | null;
      planned_end_date: string | null;
      requisition_id: string | null;
    }[]>`select id, title, start_date, planned_end_date, requisition_id from tasks where id = ${kanbanId} or id = ${requisitionId} order by title`;
    await sql.end();
    const databaseRows = rows.map((row) => ({
      ...row,
      start_date: row.start_date ? new Date(row.start_date).toISOString().slice(0, 10) : null,
      planned_end_date: row.planned_end_date
        ? new Date(row.planned_end_date).toISOString().slice(0, 10)
        : null,
    }));
    records.push({ kind: "database", rows: databaseRows });
    await page.screenshot({ path: test.info().outputPath("task-dates-final.png"), fullPage: true });
    await writeFile(
      test.info().outputPath("task-dates-records.json"),
      JSON.stringify({ records, consoleErrors, pageErrors, frontendUrl: page.url() }, null, 2),
    );
    await test.info().attach("task-dates-records", {
      body: JSON.stringify({ records, consoleErrors, pageErrors, frontendUrl: page.url() }, null, 2),
      contentType: "application/json",
    });
    await page.context().tracing.stop({ path: test.info().outputPath("task-dates-trace.zip") });

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(records.filter((record) => record.kind === "request")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ body: expect.objectContaining({ startDate: "2026-08-20", plannedEndDate: "2026-08-25" }) }),
      ]),
    );
    expect(databaseRows).toHaveLength(2);
    expect(databaseRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ start_date: "2026-08-20", planned_end_date: "2026-08-25", requisition_id: null }),
        expect.objectContaining({ start_date: "2026-08-20", planned_end_date: "2026-08-25", requisition_id: fixture.monthlyInside }),
      ]),
    );
  });
});
