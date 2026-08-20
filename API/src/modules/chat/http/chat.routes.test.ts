import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "@/app";
import { Message } from "@/modules/chat/domain/entities/message";
import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { User } from "@/modules/users/domain/entities/user";
import { buildTestModules, type TestModules } from "@/test/modules-test-helper";

const COMPANY = "10000000-0000-4000-8000-000000000001";
const ACTOR = "10000000-0000-4000-8000-000000000002";
const OTHER = "10000000-0000-4000-8000-000000000003";
const MISSING = "10000000-0000-4000-8000-000000000099";

describe("chat HTTP/OpenAPI", () => {
  let modules: TestModules;
  let authorization: string;

  beforeEach(async () => {
    modules = buildTestModules();
    await modules.repositories.companies.create(Company.create({ name: "Orbis" }, COMPANY));
    await modules.repositories.users.create(
      User.create({ email: "a@orbis.dev", name: "Ana", passwordHash: "x" }, ACTOR),
    );
    await modules.repositories.users.create(
      User.create({ email: "b@orbis.dev", name: "Bia", passwordHash: "x" }, OTHER),
    );
    for (const userId of [ACTOR, OTHER]) {
      const membership = Membership.create({ companyId: COMPANY, userId, position: "developer" });
      membership.changePermissions(["chat.use"]);
      await modules.repositories.memberships.create(membership);
    }
    modules.repositories.conversationMembers.names.set(ACTOR, "Ana");
    modules.repositories.conversationMembers.names.set(OTHER, "Bia");
    authorization = `Bearer ${await modules.tokenService.signAccessToken(ACTOR)}`;
  });

  it("cria, lista, envia, pagina e marca leitura sem expor editedAt/directKey", async () => {
    const app = await buildApp({ logger: false, modules });
    const created = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY}/conversations`,
      headers: { authorization },
      payload: { participantId: OTHER },
    });
    expect(created.statusCode).toBe(201);
    const conversation = created.json();
    expect(conversation.participants.map((item: { userId: string }) => item.userId)).toEqual([
      ACTOR,
      OTHER,
    ]);
    expect(conversation.participants).toHaveLength(2);
    expect(modules.repositories.conversationMembers.items).toHaveLength(2);
    expect(conversation).not.toHaveProperty("directKey");

    const sent = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY}/conversations/${conversation.id}/messages`,
      headers: { authorization },
      payload: { body: "  olá  " },
    });
    expect(sent.statusCode).toBe(201);
    expect(sent.json()).toMatchObject({ body: "olá", senderId: ACTOR });
    expect(sent.json()).not.toHaveProperty("editedAt");

    const otherAuthorization = `Bearer ${await modules.tokenService.signAccessToken(OTHER)}`;
    const reply = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY}/conversations/${conversation.id}/messages`,
      headers: { authorization: otherAuthorization },
      payload: { body: "resposta" },
    });
    expect(reply.statusCode).toBe(201);
    const listed = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY}/conversations`,
      headers: { authorization },
    });
    expect(listed.json().items[0]).toMatchObject({
      id: conversation.id,
      unreadCount: 1,
      lastMessage: { body: "resposta", senderId: OTHER },
    });

    const page = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY}/conversations/${conversation.id}/messages?limit=1`,
      headers: { authorization },
    });
    expect(page.json()).toMatchObject({ hasMore: true });
    expect(page.json().items).toHaveLength(1);

    const read = await app.inject({
      method: "PATCH",
      url: `/companies/${COMPANY}/conversations/${conversation.id}/read`,
      headers: { authorization },
    });
    expect(read.statusCode).toBe(200);
    expect(read.json()).toMatchObject({ conversationId: conversation.id, unreadCount: 0 });
    const repeatedRead = await app.inject({
      method: "PATCH",
      url: `/companies/${COMPANY}/conversations/${conversation.id}/read`,
      headers: { authorization },
    });
    expect(repeatedRead.json().lastReadAt).toBe(read.json().lastReadAt);
    await app.close();
  });

  it("lista participantes ativos por nome usando somente chat.use e o tenant ativo", async () => {
    const app = await buildApp({ logger: false, modules });
    const result = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY}/chat/participants?search=Bia`,
      headers: { authorization },
    });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual([{ userId: OTHER, name: "Bia" }]);

    const inactive = User.create({
      email: "inactive-chat@orbis.dev",
      name: "Bia Inativa",
      passwordHash: "x",
    });
    inactive.deactivate();
    await modules.repositories.users.create(inactive);
    const membership = Membership.create({
      companyId: COMPANY,
      userId: inactive.id,
      position: "developer",
    });
    membership.changePermissions(["chat.use"]);
    await modules.repositories.memberships.create(membership);
    const excluded = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY}/chat/participants?search=Bia`,
      headers: { authorization },
    });
    expect(excluded.json()).toEqual([{ userId: OTHER, name: "Bia" }]);
    await app.close();
  });

  it("rejeita payload/query/cursor extras e duplicata com os status contratuais", async () => {
    const app = await buildApp({ logger: false, modules });
    const request = () =>
      app.inject({
        method: "POST",
        url: `/companies/${COMPANY}/conversations`,
        headers: { authorization },
        payload: { participantId: OTHER },
      });
    expect((await request()).statusCode).toBe(201);
    expect((await request()).statusCode).toBe(409);
    const conversationId = modules.repositories.conversations.items[0]?.id;
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/companies/${COMPANY}/conversations`,
          headers: { authorization },
          payload: { participantId: OTHER, senderId: OTHER },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/companies/${COMPANY}/conversations/${conversationId}/messages`,
          headers: { authorization },
          payload: { body: "oi", senderId: OTHER },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/companies/${COMPANY}/conversations/${conversationId}/messages?before=invalid`,
          headers: { authorization },
        })
      ).statusCode,
    ).toBe(400);
    await app.close();
  });

  it("valida self, existência e atividade do participante e da membership", async () => {
    const app = await buildApp({ logger: false, modules });
    const create = (participantId: string) =>
      app.inject({
        method: "POST",
        url: `/companies/${COMPANY}/conversations`,
        headers: { authorization },
        payload: { participantId },
      });

    expect((await create(ACTOR)).statusCode).toBe(422);
    expect((await create(MISSING)).statusCode).toBe(404);

    const noMembership = User.create({
      email: "sem-membership@orbis.dev",
      name: "Sem membership",
      passwordHash: "x",
    });
    await modules.repositories.users.create(noMembership);
    expect((await create(noMembership.id)).statusCode).toBe(404);

    const inactive = User.create({
      email: "inativo@orbis.dev",
      name: "Inativo",
      passwordHash: "x",
    });
    inactive.deactivate();
    await modules.repositories.users.create(inactive);
    const inactiveMembership = Membership.create({
      companyId: COMPANY,
      userId: inactive.id,
      position: "developer",
    });
    await modules.repositories.memberships.create(inactiveMembership);
    expect((await create(inactive.id)).statusCode).toBe(403);

    const otherMembership = await modules.repositories.memberships.findByUserAndCompany(
      OTHER,
      COMPANY,
    );
    otherMembership?.deactivate();
    expect((await create(OTHER)).statusCode).toBe(403);
    await app.close();
  });

  it("normaliza body e rejeita vazio, mais de 5000 caracteres e campos extras", async () => {
    const app = await buildApp({ logger: false, modules });
    const created = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY}/conversations`,
      headers: { authorization },
      payload: { participantId: OTHER },
    });
    const url = `/companies/${COMPANY}/conversations/${created.json().id}/messages`;
    const send = (payload: unknown) =>
      app.inject({ method: "POST", url, headers: { authorization }, payload });

    expect((await send({ body: "  mensagem  " })).json()).toMatchObject({
      body: "mensagem",
      senderId: ACTOR,
    });
    for (const payload of [
      { body: "" },
      { body: "   " },
      { body: "x".repeat(5001) },
      { body: "oi", senderId: OTHER },
    ]) {
      expect((await send(payload)).statusCode).toBe(400);
    }
    expect((await send({ body: "x".repeat(5000) })).statusCode).toBe(201);
    await app.close();
  });

  it("aplica limits 50/1/100 e rejeita 0 e acima de 100", async () => {
    const app = await buildApp({ logger: false, modules });
    const created = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY}/conversations`,
      headers: { authorization },
      payload: { participantId: OTHER },
    });
    const conversationId = created.json().id as string;
    const at = new Date("2026-08-14T12:00:00.000Z");
    for (let index = 1; index <= 51; index += 1) {
      await modules.repositories.messages.create(
        Message.create(
          conversationId,
          OTHER,
          `m${index}`,
          new Date(at.getTime() + index),
          `20000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
        ),
      );
    }
    const list = (query = "") =>
      app.inject({
        method: "GET",
        url: `/companies/${COMPANY}/conversations/${conversationId}/messages${query}`,
        headers: { authorization },
      });

    expect((await list()).json().items).toHaveLength(50);
    expect((await list("?limit=1")).json().items).toHaveLength(1);
    expect((await list("?limit=100")).json().items).toHaveLength(51);
    expect((await list("?limit=0")).statusCode).toBe(400);
    expect((await list("?limit=101")).statusCode).toBe(400);
    await app.close();
  });

  it("pagina pelo par createdAt/id em empate sem omitir nem duplicar", async () => {
    const app = await buildApp({ logger: false, modules });
    const created = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY}/conversations`,
      headers: { authorization },
      payload: { participantId: OTHER },
    });
    const conversationId = created.json().id as string;
    const at = new Date("2026-08-14T12:00:00.000Z");
    const ids = [
      "30000000-0000-4000-8000-000000000001",
      "30000000-0000-4000-8000-000000000002",
      "30000000-0000-4000-8000-000000000003",
    ];
    for (const id of ids) {
      await modules.repositories.messages.create(Message.create(conversationId, OTHER, id, at, id));
    }

    const seen: string[] = [];
    let before: string | null = null;
    do {
      const response = await app.inject({
        method: "GET",
        url: `/companies/${COMPANY}/conversations/${conversationId}/messages?limit=1${
          before ? `&before=${before}` : ""
        }`,
        headers: { authorization },
      });
      const page = response.json();
      seen.push(...page.items.map((item: { id: string }) => item.id));
      before = page.nextCursor;
    } while (before);

    expect(seen).toEqual([...ids].reverse());
    expect(new Set(seen).size).toBe(ids.length);
    await app.close();
  });

  it("conta unread somente do outro após lastReadAt e read vazio é idempotente", async () => {
    const app = await buildApp({ logger: false, modules });
    const created = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY}/conversations`,
      headers: { authorization },
      payload: { participantId: OTHER },
    });
    const conversationId = created.json().id as string;
    const readUrl = `/companies/${COMPANY}/conversations/${conversationId}/read`;
    const emptyRead = await app.inject({
      method: "PATCH",
      url: readUrl,
      headers: { authorization },
    });
    expect(emptyRead.json()).toMatchObject({ lastReadAt: null, unreadCount: 0 });
    expect(
      (await app.inject({ method: "PATCH", url: readUrl, headers: { authorization } })).json(),
    ).toEqual(emptyRead.json());

    const otherAuthorization = `Bearer ${await modules.tokenService.signAccessToken(OTHER)}`;
    const messagesUrl = `/companies/${COMPANY}/conversations/${conversationId}/messages`;
    await app.inject({
      method: "POST",
      url: messagesUrl,
      headers: { authorization: otherAuthorization },
      payload: { body: "antes" },
    });
    const firstRead = await app.inject({
      method: "PATCH",
      url: readUrl,
      headers: { authorization },
    });
    await app.inject({
      method: "POST",
      url: messagesUrl,
      headers: { authorization },
      payload: { body: "minha" },
    });
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/companies/${COMPANY}/conversations`,
          headers: { authorization },
        })
      ).json().items[0].unreadCount,
    ).toBe(0);
    await app.inject({
      method: "POST",
      url: messagesUrl,
      headers: { authorization: otherAuthorization },
      payload: { body: "depois" },
    });
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/companies/${COMPANY}/conversations`,
          headers: { authorization },
        })
      ).json().items[0].unreadCount,
    ).toBe(1);
    expect(
      (await app.inject({ method: "PATCH", url: readUrl, headers: { authorization } })).json()
        .lastReadAt,
    ).not.toBe(firstRead.json().lastReadAt);
    await app.close();
  });

  it("publica schemas sem campos internos e somente respostas aplicáveis nos seis endpoints", async () => {
    const app = await buildApp({ logger: false, modules });
    await app.ready();
    const paths = app.swagger().paths;
    const collection = paths["/companies/{companyId}/conversations"];
    const messages = paths["/companies/{companyId}/conversations/{conversationId}/messages"];
    const read = paths["/companies/{companyId}/conversations/{conversationId}/read"];
    const participants = paths["/companies/{companyId}/chat/participants"];
    expect(collection).toMatchObject({ post: expect.any(Object), get: expect.any(Object) });
    expect(messages).toMatchObject({ post: expect.any(Object), get: expect.any(Object) });
    expect(read).toMatchObject({ patch: expect.any(Object) });
    expect(participants).toMatchObject({ get: expect.any(Object) });
    expect(Object.keys(participants?.get?.responses ?? {}).sort()).toEqual([
      "200",
      "400",
      "401",
      "403",
    ]);
    expect(Object.keys(collection?.post?.responses ?? {}).sort()).toEqual([
      "201",
      "400",
      "401",
      "403",
      "404",
      "409",
      "422",
    ]);
    expect(Object.keys(collection?.get?.responses ?? {}).sort()).toEqual([
      "200",
      "400",
      "401",
      "403",
    ]);
    for (const operation of [messages?.get, messages?.post, read?.patch]) {
      expect(Object.keys(operation?.responses ?? {}).sort()).toEqual([
        operation === messages?.post ? "201" : "200",
        "400",
        "401",
        "403",
        "404",
      ]);
    }
    const serialized = JSON.stringify({ collection, messages, read });
    expect(serialized).not.toContain("editedAt");
    expect(serialized).not.toContain("directKey");
    await app.close();
  });

  it("exige autenticação e chat.use nos seis endpoints", async () => {
    const app = await buildApp({ logger: false, modules });
    const conversationId = crypto.randomUUID();
    const requests = [
      {
        method: "POST",
        url: `/companies/${COMPANY}/conversations`,
        payload: { participantId: OTHER },
      },
      { method: "GET", url: `/companies/${COMPANY}/conversations` },
      { method: "GET", url: `/companies/${COMPANY}/chat/participants?search=Bia` },
      { method: "GET", url: `/companies/${COMPANY}/conversations/${conversationId}/messages` },
      {
        method: "POST",
        url: `/companies/${COMPANY}/conversations/${conversationId}/messages`,
        payload: { body: "oi" },
      },
      { method: "PATCH", url: `/companies/${COMPANY}/conversations/${conversationId}/read` },
    ] as const;
    for (const request of requests) {
      expect((await app.inject(request)).statusCode).toBe(401);
    }

    const membership = await modules.repositories.memberships.findByUserAndCompany(ACTOR, COMPANY);
    membership?.changePermissions([]);
    for (const request of requests) {
      expect((await app.inject({ ...request, headers: { authorization } })).statusCode).toBe(403);
    }
    await app.close();
  });

  it("nega permissão, membership e empresa inativas", async () => {
    const actorMembership = await modules.repositories.memberships.findByUserAndCompany(
      ACTOR,
      COMPANY,
    );
    if (!actorMembership) throw new Error("membership ausente");
    actorMembership.changePermissions([]);
    const app = await buildApp({ logger: false, modules });
    const request = () =>
      app.inject({
        method: "GET",
        url: `/companies/${COMPANY}/conversations`,
        headers: { authorization },
      });
    expect((await request()).statusCode).toBe(403);
    actorMembership.changePermissions(["chat.use"]);
    actorMembership.deactivate();
    expect((await request()).statusCode).toBe(403);
    actorMembership.reactivate();
    const company = await modules.repositories.companies.findById(COMPANY);
    if (!company) throw new Error("empresa ausente");
    company.deactivate();
    expect((await request()).statusCode).toBe(403);
    await app.close();
  });

  it("isola tenant e não participante e rejeita participante inativo", async () => {
    const app = await buildApp({ logger: false, modules });
    const created = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY}/conversations`,
      headers: { authorization },
      payload: { participantId: OTHER },
    });
    const conversationId = created.json().id;
    const outsider = User.create({ email: "c@orbis.dev", name: "Caio", passwordHash: "x" });
    await modules.repositories.users.create(outsider);
    const outsiderMembership = Membership.create({
      companyId: COMPANY,
      userId: outsider.id,
      position: "developer",
    });
    outsiderMembership.changePermissions(["chat.use"]);
    await modules.repositories.memberships.create(outsiderMembership);
    const outsiderAuthorization = `Bearer ${await modules.tokenService.signAccessToken(outsider.id)}`;
    const nonParticipant = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY}/conversations/${conversationId}/messages`,
      headers: { authorization: outsiderAuthorization },
    });
    expect(nonParticipant.statusCode).toBe(404);
    for (const request of [
      { method: "POST", payload: { body: "oi" } },
      { method: "PATCH" },
    ] as const) {
      expect(
        (
          await app.inject({
            ...request,
            url:
              request.method === "PATCH"
                ? `/companies/${COMPANY}/conversations/${conversationId}/read`
                : `/companies/${COMPANY}/conversations/${conversationId}/messages`,
            headers: { authorization: outsiderAuthorization },
          })
        ).statusCode,
      ).toBe(404);
    }

    const secondCompany = Company.create({ name: "Outro tenant" });
    await modules.repositories.companies.create(secondCompany);
    const secondMembership = Membership.create({
      companyId: secondCompany.id,
      userId: ACTOR,
      position: "developer",
    });
    secondMembership.changePermissions(["chat.use"]);
    await modules.repositories.memberships.create(secondMembership);
    const crossTenant = await app.inject({
      method: "GET",
      url: `/companies/${secondCompany.id}/conversations/${conversationId}/messages`,
      headers: { authorization },
    });
    expect(crossTenant.statusCode).toBe(404);

    const outsiderUser = await modules.repositories.users.findById(outsider.id);
    outsiderUser?.deactivate();
    const inactiveParticipant = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY}/conversations`,
      headers: { authorization },
      payload: { participantId: outsider.id },
    });
    expect(inactiveParticipant.statusCode).toBe(403);
    await app.close();
  });
});
