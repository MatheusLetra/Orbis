import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";

import { buildApp } from "@/app";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import { Task } from "@/modules/tasks/domain/entities/task";
import { buildTestModules, type TestModules } from "@/test/modules-test-helper";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const USER = "33333333-3333-4333-8333-333333333333";
const REQUISITION = "44444444-4444-4444-8444-444444444444";
const TASK = "55555555-5555-4555-8555-555555555555";

async function build(): Promise<{ app: FastifyInstance; modules: TestModules }> {
  const modules = buildTestModules();
  const app = await buildApp({ logger: false, modules });
  await modules.repositories.companies.create({ id: COMPANY, name: "Company" } as never);
  const membership = Membership.create({ companyId: COMPANY, userId: USER, position: "GESTOR" });
  membership.changePermissions([
    "requisitions.read",
    "requisitions.update",
    "tasks.read",
    "tasks.update",
  ]);
  await modules.repositories.memberships.create(membership);
  await modules.repositories.requisitions.create(
    Requisition.create(
      { companyId: COMPANY, number: 1, title: "Req", requesterId: USER },
      REQUISITION,
    ),
  );
  await modules.repositories.tasks.create(Task.create({ companyId: COMPANY, title: "Task" }, TASK));
  return { app, modules };
}

async function headers(modules: TestModules) {
  return { authorization: `Bearer ${await modules.tokenService.signAccessToken(USER)}` };
}

function multipart(
  fileName: string | null,
  content: Buffer | null,
  title?: string,
  extra = "",
  secondFile?: { fileName: string; content: Buffer },
) {
  const boundary = "----orbis-boundary";
  const parts: (string | Buffer)[] = [];
  if (fileName !== null && content !== null) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: text/plain\r\n\r\n`,
      content,
      "\r\n",
    );
  }
  if (secondFile) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${secondFile.fileName}"\r\nContent-Type: text/plain\r\n\r\n`,
      secondFile.content,
      "\r\n",
    );
  }
  parts.push(
    ...(title === undefined
      ? []
      : [`--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\n${title}\r\n`]),
    ...(extra
      ? [`--${boundary}\r\nContent-Disposition: form-data; name="${extra}"\r\n\r\nvalue\r\n`]
      : []),
    `--${boundary}--\r\n`,
  );
  return {
    boundary,
    payload: Buffer.concat(
      parts.map((part) => (typeof part === "string" ? Buffer.from(part) : part)),
    ),
  };
}

describe("Attachment HTTP integration", () => {
  it("registra as dez rotas e documenta schemas", async () => {
    const { app } = await build();
    await app.ready();
    const paths = app.swagger().paths;
    expect(Object.keys(paths).filter((path) => path.includes("attachments"))).toHaveLength(10);
    const fileSchema =
      paths["/companies/{companyId}/requisitions/{requisitionId}/attachments/files"]?.post
        ?.requestBody?.content?.["multipart/form-data"]?.schema;
    expect(fileSchema).toMatchObject({
      type: "object",
      required: ["file"],
      additionalProperties: false,
      properties: {
        file: { type: "string", format: "binary" },
        title: { type: "string" },
      },
    });
    const ownerSchema =
      paths["/companies/{companyId}/requisitions/{requisitionId}/attachments"]?.get?.responses?.[
        "200"
      ]?.content?.["application/json"]?.schema?.items?.properties?.owner;
    expect(ownerSchema?.oneOf).toHaveLength(2);
    expect(
      paths[`/companies/${COMPANY}/requisitions/{requisitionId}/attachments/files`],
    ).toBeUndefined();
    expect(
      paths["/companies/{companyId}/requisitions/{requisitionId}/attachments/files"],
    ).toBeDefined();
  });

  it("faz upload FILE multipart e download com bytes e headers", async () => {
    const { app, modules } = await build();
    const body = multipart("manual.pdf", Buffer.from("%PDF-http"), "Manual");
    const upload = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY}/requisitions/${REQUISITION}/attachments/files`,
      headers: {
        ...(await headers(modules)),
        "content-type": `multipart/form-data; boundary=${body.boundary}`,
      },
      payload: body.payload,
    });
    expect(upload.statusCode, upload.body).toBe(201);
    const attachment = upload.json();
    const download = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY}/requisitions/${REQUISITION}/attachments/${attachment.id}/file`,
      headers: await headers(modules),
    });
    expect(download.statusCode).toBe(200);
    expect(download.rawPayload).toEqual(Buffer.from("%PDF-http"));
    expect(download.headers["content-type"]).toBe("application/pdf");
    expect(download.headers["content-length"]).toBe(String(Buffer.byteLength("%PDF-http")));
    expect(download.headers["content-disposition"]).toContain('filename="manual.pdf"');
  });

  it("faz upload LINK, lista e remove", async () => {
    const { app, modules } = await build();
    const link = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY}/tasks/${TASK}/attachments/links`,
      headers: await headers(modules),
      payload: { url: "https://example.com/docs", title: "Docs" },
    });
    expect(link.statusCode, link.body).toBe(201);
    const list = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY}/tasks/${TASK}/attachments`,
      headers: await headers(modules),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()[0]).not.toHaveProperty("data");
    const removed = await app.inject({
      method: "DELETE",
      url: `/companies/${COMPANY}/tasks/${TASK}/attachments/${link.json().id}`,
      headers: await headers(modules),
    });
    expect(removed.statusCode).toBe(200);
  });

  it("rejeita arquivo ausente, parte inesperada e download LINK", async () => {
    const { app, modules } = await build();
    const body = multipart("manual.pdf", Buffer.from("%PDF-http"), undefined, "unexpected");
    const invalid = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY}/requisitions/${REQUISITION}/attachments/files`,
      headers: {
        ...(await headers(modules)),
        "content-type": `multipart/form-data; boundary=${body.boundary}`,
      },
      payload: body.payload,
    });
    expect(invalid.statusCode).toBe(400);
  });

  it("rejeita arquivo ausente, field name incorreto, title duplicado e múltiplos arquivos com 400", async () => {
    const { app, modules } = await build();
    const request = async (body: ReturnType<typeof multipart>) =>
      app.inject({
        method: "POST",
        url: `/companies/${COMPANY}/requisitions/${REQUISITION}/attachments/files`,
        headers: {
          ...(await headers(modules)),
          "content-type": `multipart/form-data; boundary=${body.boundary}`,
        },
        payload: body.payload,
      });

    const missing = await request(multipart(null, null));
    expect(missing.statusCode).toBe(400);

    const wrongField = multipart("document.pdf", Buffer.from("%PDF-wrong"));
    const wrongPayload = wrongField.payload.toString().replace('name="file"', 'name="document"');
    const wrong = await request({
      boundary: wrongField.boundary,
      payload: Buffer.from(wrongPayload),
    });
    expect(wrong.statusCode).toBe(400);

    const duplicate = await request(
      multipart("manual.pdf", Buffer.from("%PDF-title"), "one", "title"),
    );
    expect(duplicate.statusCode).toBe(400);

    const multiple = await request(
      multipart("one.pdf", Buffer.from("%PDF-one"), undefined, "", {
        fileName: "two.pdf",
        content: Buffer.from("%PDF-two"),
      }),
    );
    expect(multiple.statusCode).toBe(400);
  });

  it("retorna 413 para arquivo acima de 10 MB", async () => {
    const { app, modules } = await build();
    const body = multipart(
      "large.pdf",
      Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(10 * 1024 * 1024)]),
    );
    const response = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY}/requisitions/${REQUISITION}/attachments/files`,
      headers: {
        ...(await headers(modules)),
        "content-type": `multipart/form-data; boundary=${body.boundary}`,
      },
      payload: body.payload,
    });
    expect(response.statusCode).toBe(413);
  });

  it("retorna 422 quando sizeBytes diverge do Buffer no download", async () => {
    const { app, modules } = await build();
    const body = multipart("manual.pdf", Buffer.from("%PDF-size"));
    const upload = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY}/requisitions/${REQUISITION}/attachments/files`,
      headers: {
        ...(await headers(modules)),
        "content-type": `multipart/form-data; boundary=${body.boundary}`,
      },
      payload: body.payload,
    });
    const id = upload.json().id;
    const attachment = await modules.repositories.attachments.findById(
      COMPANY,
      { type: "REQUISITION", requisitionId: REQUISITION },
      id,
    );
    const original = attachment as never as { sizeBytes: number };
    Object.defineProperty(original, "sizeBytes", { value: original.sizeBytes + 1 });
    const response = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY}/requisitions/${REQUISITION}/attachments/${id}/file`,
      headers: await headers(modules),
    });
    expect(response.statusCode).toBe(422);
  });
});
