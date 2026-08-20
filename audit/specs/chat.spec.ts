import { expect, test, type Page } from "@playwright/test";
import { fixture } from "../fixtures/fixture-types";
import { login } from "../support/auth";
import { expectNoExternalOverflow, observePage } from "../support/observability";

const conversationsPath = /\/companies\/[^/]+\/conversations$/;
const messagesPath = (conversationId: string) =>
  new RegExp(`/companies/[^/]+/conversations/${conversationId}/messages\\?`);

test.describe.serial("Chat M17 @chat", () => {
  test("navega pela UI, expõe loading e lista somente as conversas do tenant ativo", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route(conversationsPath, async (route) => {
      await gate;
      await route.fallback();
    });

    await login(page);
    await page.goto("/kanban");
    await page.getByRole("link", { name: "Chat", exact: true }).click();
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByText("Carregando conversas...", { exact: true })).toBeVisible();
    release();

    await expect(page.getByRole("heading", { name: "Chat", level: 1 })).toBeVisible();
    await expect(conversationButton(page, "Audit Third")).toBeVisible();
    await expect(page.getByText("Audit Chat Tenant B", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Selecione uma conversa" })).toBeVisible();
    await finishObservation();
  });

  test("pagina mais de 50 mensagens sem duplicação, distingue autoria e marca unread como read", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    await login(page);
    await page.goto("/chat");
    const conversation = conversationButton(page, "Audit Third");
    await expect(conversation.getByText("2 mensagens não lidas", { exact: true })).toBeAttached();

    const firstPage = page.waitForResponse((response) =>
      messagesPath(fixture.chatConversationA).test(response.url()) && !new URL(response.url()).searchParams.has("before") && response.status() === 200,
    );
    const markedRead = page.waitForResponse((response) =>
      response.url().endsWith(`/conversations/${fixture.chatConversationA}/read`) && response.status() === 200,
    );
    await conversation.click();
    await firstPage;
    await markedRead;

    const messages = page.getByRole("region", { name: "Mensagens" });
    await expect(messages.getByRole("listitem")).toHaveCount(50);
    await expect(messages.getByText("Audit paginada 07 - própria", { exact: true })).toBeVisible();
    await expect(messages.getByText("Audit paginada 01 - própria", { exact: true })).toHaveCount(0);
    await expect(messages.getByText("Audit paginada 53 - própria", { exact: true }).locator(".."))
      .toHaveAttribute("data-own", "true");
    await expect(messages.getByText("Audit paginada 54 - alheia", { exact: true }).locator(".."))
      .toHaveAttribute("data-own", "false");

    const previousPage = page.waitForResponse((response) =>
      messagesPath(fixture.chatConversationA).test(response.url()) && new URL(response.url()).searchParams.has("before") && response.status() === 200,
    );
    await messages.getByRole("button", { name: "Carregar mensagens anteriores" }).click();
    await previousPage;
    await expect(messages.getByRole("listitem")).toHaveCount(56);
    await expect(messages.getByText("Audit paginada 01 - própria", { exact: true })).toBeVisible();
    const bodies = await messages.locator(".chat-message > p").allTextContents();
    expect(new Set(bodies).size).toBe(56);
    await expect(conversation.getByText(/mensagens não lidas/)).toHaveCount(0);
    await finishObservation();
  });

  test("não faz optimistic update e confirma envio real após a resposta", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    const body = "Audit envio confirmado sem optimistic update";
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route(`**/conversations/${fixture.chatConversationA}/messages`, async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await gate;
      await route.fallback();
    });
    await openConversation(page);

    await page.getByLabel("Mensagem").fill(body);
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Enviando..." })).toBeDisabled();
    await expect(page.getByRole("region", { name: "Mensagens" }).getByText(body, { exact: true })).toHaveCount(0);
    const sent = page.waitForResponse((response) =>
      response.request().method() === "POST" && response.url().endsWith(`/conversations/${fixture.chatConversationA}/messages`) && response.status() === 201,
    );
    release();
    await sent;
    await expect(page.getByRole("region", { name: "Mensagens" }).getByText(body, { exact: true })).toBeVisible();
    await expect(page.getByLabel("Mensagem")).toHaveValue("");
    await finishObservation();
  });

  test("Shift+Enter preserva quebra e Enter envia", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    await openConversation(page);
    const composer = page.getByLabel("Mensagem");
    await composer.fill("Linha um");
    await composer.press("Shift+Enter");
    await composer.type("Linha dois");
    await expect(composer).toHaveValue("Linha um\nLinha dois");
    const sent = page.waitForResponse((response) =>
      response.request().method() === "POST" && response.url().endsWith(`/conversations/${fixture.chatConversationA}/messages`) && response.status() === 201,
    );
    await composer.press("Enter");
    await sent;
    await expect(page.getByRole("region", { name: "Mensagens" }).getByText("Linha um\nLinha dois", { exact: true })).toBeVisible();
    await finishObservation();
  });

  test("mostra erro seguro na lista e recupera por retry", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo, [401, 500]);
    let shouldFail = true;
    let attempts = 0;
    await page.route(conversationsPath, async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      attempts += 1;
      if (!shouldFail) return route.fallback();
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "INTERNAL", message: "detalhe técnico secreto" } }),
      });
    });
    await login(page);
    await page.goto("/chat");
    await expect(page.getByText("Não foi possível carregar as conversas. Verifique seu acesso.")).toBeVisible();
    await expect(page.getByText("detalhe técnico secreto")).toHaveCount(0);
    shouldFail = false;
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(conversationButton(page, "Audit Third")).toBeVisible();
    expect(attempts).toBeGreaterThanOrEqual(2);
    await finishObservation();
  });

  test("exibe estado vazio de mensagens pela UI", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    await page.route(messagesPath(fixture.chatConversationA), (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], hasMore: false, nextCursor: null }),
      });
    });
    await openConversation(page);
    await expect(page.getByText("Nenhuma mensagem ainda. Escreva a primeira.", { exact: true })).toBeVisible();
    await finishObservation();
  });

  test("cria conversa direta e rejeita a duplicata", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo, [401, 409]);
    await login(page);
    await page.goto("/chat");
    const participant = page.getByRole("button", { name: "Buscar participante" });
    await participant.click();
    const lookup = page.getByRole("dialog", { name: "Buscar Participante" });
    await expect(lookup.getByLabel("Busca")).toBeFocused();
    await lookup.getByLabel("Busca").fill("Audit Developer");
    await lookup.getByRole("option", { name: "Audit Developer" }).click();
    await expect(page.getByText("Selecionado: Audit Developer", { exact: true })).toBeVisible();
    const created = page.waitForResponse((response) =>
      response.request().method() === "POST" && conversationsPath.test(new URL(response.url()).pathname) && response.status() === 201,
    );
    await page.getByRole("button", { name: "Criar", exact: true }).click();
    const createdResponse = await created;
    expect(createdResponse.request().postDataJSON()).toEqual({ participantId: fixture.developerAId });
    await expect(page.getByRole("heading", { name: "Audit Developer", level: 2 })).toBeVisible();
    await expect(page.getByText("Nenhuma mensagem ainda. Escreva a primeira.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Buscar participante" }).click();
    const duplicateLookup = page.getByRole("dialog", { name: "Buscar Participante" });
    await duplicateLookup.getByLabel("Busca").fill("Audit Developer");
    await duplicateLookup.getByRole("option", { name: "Audit Developer" }).click();
    const duplicate = page.waitForResponse((response) =>
      response.request().method() === "POST" && conversationsPath.test(new URL(response.url()).pathname) && response.status() === 409,
    );
    await page.getByRole("button", { name: "Criar", exact: true }).click();
    await duplicate;
    await expect(page.getByText("Não foi possível criar a conversa. Verifique seu acesso e tente novamente.", { exact: true })).toBeVisible();
    await finishObservation();
  });

  test("troca tenant sem vazar conversas, mensagens ou seleção", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    await openConversation(page);
    await expect(page.getByText(fixture.chatLongBody, { exact: true })).toBeVisible();

    await page.getByRole("combobox", { name: /empresa/i }).selectOption(fixture.companyB);
    await expect(conversationButton(page, "Audit Chat Tenant B")).toBeVisible();
    await expect(page.getByText("Audit Third", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Selecione uma conversa" })).toBeVisible();
    await conversationButton(page, "Audit Chat Tenant B").click();
    await expect(page.getByRole("region", { name: "Mensagens" }).getByText("Resposta exclusiva tenant B", { exact: true })).toBeVisible();
    await expect(page.getByText(fixture.chatLongBody, { exact: true })).toHaveCount(0);

    await page.getByRole("combobox", { name: /empresa/i }).selectOption(fixture.companyA);
    await expect(conversationButton(page, "Audit Third")).toBeVisible();
    await expect(page.getByText("Audit Chat Tenant B", { exact: true })).toHaveCount(0);
    await finishObservation();
  });

  test("não participante autenticado não lista nem acessa a conversa de terceiros", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo, [401, 404]);
    let authorization = "";
    page.on("request", (request) => {
      if (conversationsPath.test(new URL(request.url()).pathname)) {
        authorization = request.headers().authorization ?? authorization;
      }
    });
    await loginAs(page, fixture.chatOutsiderEmail, fixture.chatOutsiderPassword);
    await page.goto("/chat");
    await expect(page.getByText("Nenhuma conversa. Inicie uma usando o UUID do participante.", { exact: true })).toBeVisible();
    await expect(page.getByText("Audit Third", { exact: true })).toHaveCount(0);
    expect(authorization).toMatch(/^Bearer /);

    const response = await page.request.get(
      `${process.env.AUDIT_API_URL}/companies/${fixture.companyA}/conversations/${fixture.chatConversationA}/messages?limit=50`,
      { headers: { Authorization: authorization } },
    );
    expect(response.status()).toBe(404);
    await finishObservation();
  });

  test("renderiza XSS como texto e conteúdo longo sem overflow em desktop e mobile", async ({ page }, testInfo) => {
    const finishObservation = observePage(page, testInfo);
    await openConversation(page);
    const messages = page.getByRole("region", { name: "Mensagens" });
    await expect(messages.getByText(fixture.chatXssBody, { exact: true })).toBeVisible();
    await expect(messages.getByText(fixture.chatLongBody, { exact: true })).toBeVisible();
    await expect(messages.locator("script, img")).toHaveCount(0);
    expect(await page.evaluate(() => (window as Window & { __auditXss?: boolean }).__auditXss)).not.toBe(true);
    await expectNoExternalOverflow(page);

    await page.setViewportSize({ width: 320, height: 844 });
    await expectNoExternalOverflow(page);
    await expect(page.getByRole("heading", { name: "Chat", level: 1 })).toBeVisible();
    for (const target of [
      page.getByRole("button", { name: "Criar", exact: true }),
      page.getByRole("button", { name: "Enviar", exact: true }),
    ]) {
      const box = await target.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
    await finishObservation();
  });
});

function conversationButton(page: Page, participant: string) {
  return page.locator(".chat-conversation-button").filter({ hasText: participant });
}

async function openConversation(page: Page): Promise<void> {
  await login(page);
  await page.goto("/chat");
  await conversationButton(page, "Audit Third").click();
  await expect(page.getByRole("heading", { name: "Audit Third", level: 2 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Mensagens" })).toBeVisible();
}

async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}
