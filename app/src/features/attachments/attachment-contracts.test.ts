import { describe, expect, it } from "vitest";
import { parseAttachmentOutputs, parseAttachmentRemoval } from "./attachment-contracts";

const valid = {
  id: "attachment-1",
  companyId: "company-a",
  owner: { type: "TASK", taskId: "task-a" },
  kind: "FILE",
  title: "Manual",
  fileName: "manual.pdf",
  mimeType: "application/pdf",
  checksum: "a".repeat(64),
  sizeBytes: 10,
  url: null,
  createdBy: "user-a",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("attachment contracts", () => {
  it("aceita FILE e LINK válidos", () => {
    expect(parseAttachmentOutputs([valid])).toEqual([valid]);
    expect(
      parseAttachmentOutputs([
        {
          ...valid,
          kind: "LINK",
          fileName: null,
          mimeType: null,
          checksum: null,
          sizeBytes: null,
          url: "https://example.com",
        },
      ])[0]?.kind,
    ).toBe("LINK");
  });

  it("rejeita resposta inválida e combinações estruturais inválidas", () => {
    expect(() => parseAttachmentOutputs({ data: [] })).toThrow();
    expect(() =>
      parseAttachmentOutputs([{ ...valid, kind: "FILE", url: "https://example.com" }]),
    ).toThrow();
    expect(() => parseAttachmentOutputs([{ ...valid, owner: { type: "TASK" } }])).toThrow();
  });

  it("valida resposta de remoção", () => {
    expect(parseAttachmentRemoval({ id: "attachment-1" })).toEqual({ id: "attachment-1" });
    expect(() => parseAttachmentRemoval({})).toThrow("Contrato de remoção");
  });
});
