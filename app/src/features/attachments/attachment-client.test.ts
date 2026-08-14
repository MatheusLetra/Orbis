import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { attachmentsClient } from "./attachment-client";
import type { AttachmentOutput } from "./attachment-contracts";

const fileAttachment: AttachmentOutput = {
  id: "attachment/a",
  companyId: "company-a",
  owner: { type: "TASK", taskId: "task-a" },
  kind: "FILE",
  title: "Manual",
  fileName: "manual.pdf",
  mimeType: "application/pdf",
  checksum: "a".repeat(64),
  sizeBytes: 3,
  url: null,
  createdBy: "user-a",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const linkAttachment: AttachmentOutput = {
  ...fileAttachment,
  id: "link-1",
  kind: "LINK",
  title: "Docs",
  fileName: null,
  mimeType: null,
  checksum: null,
  sizeBytes: null,
  url: "https://example.com/docs",
};

describe("attachments client", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("usa o endpoint de attachments da task e codifica os IDs", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue([]);
    await attachmentsClient.listForTask("company/a", "task/b");
    expect(request).toHaveBeenCalledWith(
      "/companies/company%2Fa/tasks/task%2Fb/attachments",
      undefined,
    );
  });

  it("repassa AbortSignal e não solicita conteúdo binário", async () => {
    const signal = new AbortController().signal;
    const request = vi.spyOn(apiClient, "request").mockResolvedValue([]);
    await attachmentsClient.listForTask("company-a", "task-a", { signal });
    expect(request).toHaveBeenCalledWith("/companies/company-a/tasks/task-a/attachments", {
      signal,
    });
  });

  it("cria LINK com endpoint, payload, IDs codificados e AbortSignal", async () => {
    const signal = new AbortController().signal;
    const request = vi.spyOn(apiClient, "request").mockResolvedValue(linkAttachment);
    await attachmentsClient.createTaskLink(
      "company/a",
      "task/b",
      { url: "https://example.com/docs", title: "Docs" },
      { signal },
    );
    expect(request).toHaveBeenCalledWith(
      "/companies/company%2Fa/tasks/task%2Fb/attachments/links",
      {
        method: "POST",
        body: { url: "https://example.com/docs", title: "Docs" },
        signal,
      },
    );
  });

  it("remove attachment com endpoint, IDs codificados e AbortSignal", async () => {
    const signal = new AbortController().signal;
    const request = vi.spyOn(apiClient, "request").mockResolvedValue({ id: "attachment/a" });
    await attachmentsClient.remove("company/a", "task/b", "attachment/c", { signal });
    expect(request).toHaveBeenCalledWith(
      "/companies/company%2Fa/tasks/task%2Fb/attachments/attachment%2Fc",
      { method: "DELETE", signal },
    );
  });

  it("baixa FILE com IDs codificados, MIME, filename UTF-8 e signal", async () => {
    const signal = new AbortController().signal;
    const blob = new Blob(["abc"], { type: "application/pdf" });
    const requestBlob = vi.spyOn(apiClient, "requestBlob").mockResolvedValue({
      blob,
      headers: new Headers({
        "Content-Type": "application/pdf",
        "Content-Length": "3",
        "Content-Disposition": "attachment; filename*=UTF-8''manual%20final.pdf",
      }),
    });
    const result = await attachmentsClient.downloadTaskFile("company/a", "task/b", fileAttachment, {
      signal,
    });
    expect(requestBlob).toHaveBeenCalledWith(
      "/companies/company%2Fa/tasks/task%2Fb/attachments/attachment%2Fa/file",
      { signal },
    );
    expect(result.fileName).toBe("manual final.pdf");
    expect(result.mimeType).toBe("application/pdf");
    expect(result.blob.type).toBe("application/pdf");
  });

  it("usa fallback seguro de fileName/title sem Content-Disposition", async () => {
    const requestBlob = vi.spyOn(apiClient, "requestBlob").mockResolvedValue({
      blob: new Blob(["abc"]),
      headers: new Headers({ "Content-Length": "3" }),
    });
    expect(
      (await attachmentsClient.downloadTaskFile("company-a", "task-a", fileAttachment)).fileName,
    ).toBe("manual.pdf");
    requestBlob.mockResolvedValue({ blob: new Blob(["abc"]), headers: new Headers() });
    expect(
      (
        await attachmentsClient.downloadTaskFile("company-a", "task-a", {
          ...fileAttachment,
          fileName: null,
          title: "Título",
        })
      ).fileName,
    ).toBe("Título");
  });

  it("usa o filename exposto no transporte binário autenticado", async () => {
    vi.spyOn(apiClient, "requestBlob").mockResolvedValue({
      blob: new Blob(["abc"]),
      headers: new Headers({
        "Content-Length": "3",
        "X-Orbis-File-Name": "manual%20seguro.pdf",
      }),
    });

    const result = await attachmentsClient.downloadTaskFile("company-a", "task-a", fileAttachment);

    expect(result.fileName).toBe("manual seguro.pdf");
  });

  it("não chama endpoint binário para LINK", async () => {
    const requestBlob = vi.spyOn(apiClient, "requestBlob");
    await expect(
      attachmentsClient.downloadTaskFile("company-a", "task-a", {
        ...fileAttachment,
        kind: "LINK",
        fileName: null,
        mimeType: null,
        checksum: null,
        sizeBytes: null,
        url: "https://example.com",
      }),
    ).rejects.toThrow("Somente attachments FILE");
    expect(requestBlob).not.toHaveBeenCalled();
  });

  it("rejeita resposta binária com Content-Length inconsistente", async () => {
    vi.spyOn(apiClient, "requestBlob").mockResolvedValue({
      blob: new Blob(["abc"]),
      headers: new Headers({ "Content-Length": "4" }),
    });
    await expect(
      attachmentsClient.downloadTaskFile("company-a", "task-a", fileAttachment),
    ).rejects.toMatchObject({ status: 422 });
  });
});
