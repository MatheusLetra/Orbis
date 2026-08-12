import type { FastifyInstance, FastifyRequest } from "fastify";

import { getCurrentUserId } from "@/infrastructure/http/current-user";
import type { AddFileAttachment } from "@/modules/attachments/application/use-cases/add-file-attachment";
import type { AddLinkAttachment } from "@/modules/attachments/application/use-cases/add-link-attachment";
import type { GetFileAttachment } from "@/modules/attachments/application/use-cases/get-file-attachment";
import type { ListAttachments } from "@/modules/attachments/application/use-cases/list-attachments";
import type { RemoveAttachment } from "@/modules/attachments/application/use-cases/remove-attachment";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import { BusinessRuleError, ValidationError } from "@/shared/errors/typed-errors";

export interface AttachmentRouteOptions {
  addFile: AddFileAttachment;
  addLink: AddLinkAttachment;
  list: ListAttachments;
  getFile: GetFileAttachment;
  remove: RemoveAttachment;
  permissionResolver: PermissionResolver;
}

const authHeaders = {
  type: "object",
  properties: { authorization: { type: "string" } },
} as const;
const requisitionParams = {
  type: "object",
  properties: {
    companyId: { type: "string", format: "uuid" },
    requisitionId: { type: "string", format: "uuid" },
  },
  required: ["companyId", "requisitionId"],
  additionalProperties: false,
} as const;
const taskParams = {
  type: "object",
  properties: {
    companyId: { type: "string", format: "uuid" },
    taskId: { type: "string", format: "uuid" },
  },
  required: ["companyId", "taskId"],
  additionalProperties: false,
} as const;
const attachmentParams = {
  type: "object",
  properties: { ...requisitionParams.properties, attachmentId: { type: "string", format: "uuid" } },
  required: ["companyId", "requisitionId", "attachmentId"],
  additionalProperties: false,
} as const;
const taskAttachmentParams = {
  type: "object",
  properties: { ...taskParams.properties, attachmentId: { type: "string", format: "uuid" } },
  required: ["companyId", "taskId", "attachmentId"],
  additionalProperties: false,
} as const;
const metadata = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    companyId: { type: "string", format: "uuid" },
    owner: {
      oneOf: [
        {
          type: "object",
          properties: {
            type: { const: "REQUISITION" },
            requisitionId: { type: "string", format: "uuid" },
          },
          required: ["type", "requisitionId"],
          additionalProperties: false,
        },
        {
          type: "object",
          properties: {
            type: { const: "TASK" },
            taskId: { type: "string", format: "uuid" },
          },
          required: ["type", "taskId"],
          additionalProperties: false,
        },
      ],
    },
    kind: { type: "string", enum: ["FILE", "LINK"] },
    title: { type: ["string", "null"] },
    fileName: { type: ["string", "null"] },
    mimeType: { type: ["string", "null"] },
    checksum: { type: ["string", "null"] },
    sizeBytes: { type: ["integer", "null"] },
    url: { type: ["string", "null"] },
    createdBy: { type: "string", format: "uuid" },
    createdAt: { type: "string", format: "date-time" },
  },
  required: [
    "id",
    "companyId",
    "owner",
    "kind",
    "title",
    "fileName",
    "mimeType",
    "checksum",
    "sizeBytes",
    "url",
    "createdBy",
    "createdAt",
  ],
  additionalProperties: false,
} as const;
const linkBody = {
  type: "object",
  properties: { url: { type: "string" }, title: { type: "string" } },
  required: ["url", "title"],
  additionalProperties: false,
} as const;

function owner(params: Record<string, string>, type: "REQUISITION" | "TASK") {
  return type === "REQUISITION"
    ? { type, requisitionId: requiredParam(params, "requisitionId") }
    : { type, taskId: requiredParam(params, "taskId") };
}

function requiredParam(params: Record<string, string>, name: string): string {
  const value = params[name];
  if (!value) throw new ValidationError(`Parâmetro ${name} é obrigatório`);
  return value;
}

async function actorFor(request: FastifyRequest, companyId: string, resolver: PermissionResolver) {
  return resolver.resolve(getCurrentUserId(request), companyId);
}

async function readFileParts(
  request: FastifyRequest,
): Promise<{ data: Buffer; fileName: string; title?: string }> {
  let file: Buffer | undefined;
  let fileName = "";
  let title: string | undefined;
  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (part.fieldname !== "file") throw new ValidationError("Campo de arquivo inválido");
      if (file) throw new ValidationError("Somente um arquivo é permitido");
      fileName = part.filename;
      const chunks: Buffer[] = [];
      for await (const chunk of part.file)
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      if (part.file.truncated) {
        const error = new Error("Arquivo excede o limite permitido") as Error & {
          statusCode?: number;
        };
        error.statusCode = 413;
        throw error;
      }
      file = Buffer.concat(chunks);
    } else if (part.fieldname === "title") {
      if (title !== undefined) throw new ValidationError("title repetido");
      title = String(part.value);
    } else {
      throw new ValidationError("Parte multipart inesperada");
    }
  }
  if (!file) throw new ValidationError("Arquivo é obrigatório");
  return { data: file, fileName, ...(title === undefined ? {} : { title }) };
}

function routeSet(
  app: FastifyInstance,
  options: AttachmentRouteOptions,
  kind: "REQUISITION" | "TASK",
) {
  const params = kind === "REQUISITION" ? requisitionParams : taskParams;
  const detailParams = kind === "REQUISITION" ? attachmentParams : taskAttachmentParams;
  const base =
    kind === "REQUISITION"
      ? "/companies/:companyId/requisitions/:requisitionId/attachments"
      : "/companies/:companyId/tasks/:taskId/attachments";
  const listParams = {
    schema: {
      tags: ["Anexos"],
      description: "Lista anexos.",
      headers: authHeaders,
      params,
      response: { 200: { type: "array", items: metadata } },
    },
  };
  const fileParams = {
    schema: {
      tags: ["Anexos"],
      description: "Adiciona arquivo.",
      headers: authHeaders,
      params,
      consumes: ["multipart/form-data"],
      response: { 201: metadata },
    },
  };
  const linkParams = {
    schema: {
      tags: ["Anexos"],
      description: "Adiciona link.",
      headers: authHeaders,
      params,
      body: linkBody,
      response: { 201: metadata },
    },
  };
  app.post(`${base}/files`, fileParams, async (request, reply) => {
    const parsed = await readFileParts(request);
    const paramsValue = request.params as Record<string, string>;
    const actor = await actorFor(
      request,
      requiredParam(paramsValue, "companyId"),
      options.permissionResolver,
    );
    return reply.status(201).send(
      await options.addFile.execute({
        actor,
        data: { owner: owner(paramsValue, kind), ...parsed },
      }),
    );
  });
  app.post(
    `${base}/links`,
    { ...linkParams, schema: { ...linkParams.schema, body: linkBody } },
    async (request, reply) => {
      const paramsValue = request.params as Record<string, string>;
      const actor = await actorFor(
        request,
        requiredParam(paramsValue, "companyId"),
        options.permissionResolver,
      );
      return reply.status(201).send(
        await options.addLink.execute({
          actor,
          data: {
            owner: owner(paramsValue, kind),
            ...(request.body as { url: string; title: string }),
          },
        }),
      );
    },
  );
  app.get(base, listParams, async (request) => {
    const paramsValue = request.params as Record<string, string>;
    const actor = await actorFor(
      request,
      requiredParam(paramsValue, "companyId"),
      options.permissionResolver,
    );
    return options.list.execute({ actor, data: { owner: owner(paramsValue, kind) } });
  });
  app.get(
    `${base}/:attachmentId/file`,
    {
      schema: {
        tags: ["Anexos"],
        description: "Baixa arquivo.",
        headers: authHeaders,
        params: detailParams,
        response: {
          200: {
            content: {
              "application/octet-stream": { schema: { type: "string", format: "binary" } },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const paramsValue = request.params as Record<string, string>;
      const actor = await actorFor(
        request,
        requiredParam(paramsValue, "companyId"),
        options.permissionResolver,
      );
      const result = await options.getFile.execute({
        actor,
        data: {
          owner: owner(paramsValue, kind),
          attachmentId: requiredParam(paramsValue, "attachmentId"),
        },
      });
      if (
        result.attachment.kind !== "FILE" ||
        !result.attachment.fileName ||
        !result.attachment.mimeType ||
        result.attachment.sizeBytes === null ||
        result.attachment.sizeBytes !== result.data.length
      )
        throw new BusinessRuleError("Integridade do anexo inválida");
      const fallback = result.attachment.fileName.replace(/["\\\r\n]/g, "_");
      const encoded = encodeURIComponent(result.attachment.fileName);
      reply
        .header("Content-Type", result.attachment.mimeType)
        .header("Content-Length", String(result.data.length))
        .header(
          "Content-Disposition",
          `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`,
        );
      return reply.send(result.data);
    },
  );
  app.delete(
    `${base}/:attachmentId`,
    {
      schema: {
        tags: ["Anexos"],
        description: "Remove anexo.",
        headers: authHeaders,
        params: detailParams,
        response: {
          200: {
            type: "object",
            properties: { id: { type: "string", format: "uuid" } },
            required: ["id"],
          },
        },
      },
    },
    async (request) => {
      const paramsValue = request.params as Record<string, string>;
      const actor = await actorFor(
        request,
        requiredParam(paramsValue, "companyId"),
        options.permissionResolver,
      );
      return options.remove.execute({
        actor,
        data: {
          owner: owner(paramsValue, kind),
          attachmentId: requiredParam(paramsValue, "attachmentId"),
        },
      });
    },
  );
}

export async function registerAttachmentRoutes(
  app: FastifyInstance,
  options: AttachmentRouteOptions,
): Promise<void> {
  routeSet(app, options, "REQUISITION");
  routeSet(app, options, "TASK");
}
