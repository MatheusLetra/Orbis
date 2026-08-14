import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { attachmentsClient } from "./attachment-client";
import type { AttachmentOutput } from "./attachment-contracts";

const attachment: AttachmentOutput = {
  id: "attachment-a",
  companyId: "company-a",
  owner: { type: "TASK", taskId: "task-a" },
  kind: "FILE",
  title: "Relatório",
  fileName: "report.pdf",
  mimeType: null,
  checksum: "a".repeat(64),
  sizeBytes: 3,
  url: null,
  createdBy: "user-a",
  createdAt: "2026-08-14T00:00:00.000Z",
};

function mockDownload(headers: HeadersInit = {}) {
  return vi.spyOn(apiClient, "requestBlob").mockResolvedValue({
    blob: new Blob(["abc"]),
    headers: new Headers(headers),
  });
}

describe("attachment client filename fallbacks", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("cai do header de transporte malformado para filename regular", async () => {
    mockDownload({
      "X-Orbis-File-Name": "%E0%A4%A",
      "Content-Disposition": 'attachment; filename="regular.pdf"',
    });

    const result = await attachmentsClient.downloadTaskFile("company-a", "task-a", attachment);

    expect(result.fileName).toBe("regular.pdf");
    expect(result.mimeType).toBe("application/octet-stream");
    expect(result.blob.type).toBe("application/octet-stream");
  });

  it("cai do filename UTF-8 malformado para filename sem aspas", async () => {
    mockDownload({
      "Content-Disposition": "attachment; filename*=UTF-8''%E0%A4%A; filename=backup.pdf",
    });

    const result = await attachmentsClient.downloadTaskFile("company-a", "task-a", attachment);

    expect(result.fileName).toBe("backup.pdf");
  });

  it.each([
    ['attachment; filename="../secret.txt"', ".._secret.txt"],
    ['attachment; filename="..."', "_"],
    ['attachment; filename="   "', "attachment"],
  ])("sanitiza filename inseguro %s", async (disposition, expected) => {
    mockDownload({ "Content-Disposition": disposition });

    const result = await attachmentsClient.downloadTaskFile("company-a", "task-a", attachment);

    expect(result.fileName).toBe(expected);
  });

  it("aceita download sem Content-Length e usa MIME do attachment", async () => {
    mockDownload();

    const result = await attachmentsClient.downloadTaskFile("company-a", "task-a", {
      ...attachment,
      mimeType: "application/pdf",
    });

    expect(result.fileName).toBe("report.pdf");
    expect(result.mimeType).toBe("application/pdf");
  });
});
