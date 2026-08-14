import { apiClient, type RequestOptions } from "@/lib/http/api-client";
import { ApiError } from "@/lib/http/api-error";
import type { AttachmentOutput } from "./attachment-contracts";
import {
  parseAttachmentOutput,
  parseAttachmentOutputs,
  parseAttachmentRemoval,
} from "./attachment-contracts";

export interface DownloadedAttachment {
  blob: Blob;
  fileName: string;
  mimeType: string;
}

export const attachmentsClient = {
  listForTask(companyId: string, taskId: string, options?: Pick<RequestOptions, "signal">) {
    return apiClient
      .request<unknown>(
        `/companies/${encodeURIComponent(companyId)}/tasks/${encodeURIComponent(taskId)}/attachments`,
        options,
      )
      .then(parseAttachmentOutputs);
  },
  uploadTaskFile(
    companyId: string,
    taskId: string,
    file: File,
    title?: string,
    options?: Pick<RequestOptions, "signal">,
  ) {
    const body = new FormData();
    body.append("file", file);
    if (title?.trim()) body.append("title", title.trim());
    return apiClient
      .request<unknown>(
        `/companies/${encodeURIComponent(companyId)}/tasks/${encodeURIComponent(taskId)}/attachments/files`,
        { method: "POST", body, ...options },
      )
      .then(parseAttachmentOutput);
  },
  createTaskLink(
    companyId: string,
    taskId: string,
    input: { url: string; title: string },
    options?: Pick<RequestOptions, "signal">,
  ) {
    return apiClient
      .request<unknown>(
        `/companies/${encodeURIComponent(companyId)}/tasks/${encodeURIComponent(taskId)}/attachments/links`,
        {
          method: "POST",
          body: input,
          ...options,
        },
      )
      .then(parseAttachmentOutput);
  },
  remove(
    companyId: string,
    taskId: string,
    attachmentId: string,
    options?: Pick<RequestOptions, "signal">,
  ) {
    return apiClient
      .request<unknown>(
        `/companies/${encodeURIComponent(companyId)}/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}`,
        { method: "DELETE", ...options },
      )
      .then(parseAttachmentRemoval);
  },
  async downloadTaskFile(
    companyId: string,
    taskId: string,
    attachment: AttachmentOutput,
    options?: Pick<RequestOptions, "signal">,
  ): Promise<DownloadedAttachment> {
    if (attachment.kind !== "FILE") {
      throw new Error("Somente attachments FILE podem ser baixados");
    }

    const response = await apiClient.requestBlob(
      `/companies/${encodeURIComponent(companyId)}/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachment.id)}/file`,
      options,
    );
    const contentLength = response.headers.get("Content-Length");
    if (contentLength && Number(contentLength) !== response.blob.size) {
      throw new ApiError({
        status: 422,
        code: "ATTACHMENT_INTEGRITY_ERROR",
        message: "A integridade do attachment não pôde ser confirmada.",
      });
    }

    const mimeType =
      response.headers.get("Content-Type") || attachment.mimeType || "application/octet-stream";
    return {
      blob: new Blob([response.blob], { type: mimeType }),
      fileName: fileNameFromHeaders(
        response.headers.get("Content-Disposition"),
        attachment,
        response.headers.get("X-Orbis-File-Name"),
      ),
      mimeType,
    };
  },
};

function fileNameFromHeaders(
  value: string | null,
  attachment: AttachmentOutput,
  encodedFileName: string | null,
): string {
  if (encodedFileName) {
    try {
      return safeFileName(decodeURIComponent(encodedFileName));
    } catch {
      // Fall through to Content-Disposition and attachment metadata.
    }
  }
  const encoded = value?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return safeFileName(decodeURIComponent(encoded));
    } catch {
      // Fallback to the regular filename when the header is malformed.
    }
  }

  const regular = value?.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i);
  return safeFileName(
    regular?.[1] ?? regular?.[2] ?? attachment.fileName ?? attachment.title ?? "attachment",
  );
}

function safeFileName(value: string): string {
  const sanitized = value
    .trim()
    .split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return character === "\\" || character === "/" || code <= 0x1f || code === 0x7f
        ? "_"
        : character;
    })
    .join("")
    .replace(/^\.+$/, "_");
  return sanitized || "attachment";
}
