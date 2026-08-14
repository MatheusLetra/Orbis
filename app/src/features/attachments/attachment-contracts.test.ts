import { describe, expect, it } from "vitest";
import {
  parseAttachmentOutput,
  parseAttachmentOutputs,
  parseAttachmentRemoval,
} from "./attachment-contracts";

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

  it("aceita owner de requisition e parseia saída unitária", () => {
    const attachment = { ...valid, owner: { type: "REQUISITION", requisitionId: "req-a" } };
    expect(parseAttachmentOutput(attachment)).toEqual(attachment);
  });

  it.each([
    null,
    { ...valid, kind: "UNKNOWN" },
    { ...valid, sizeBytes: -1 },
    { ...valid, owner: { type: "REQUISITION" } },
    {
      ...valid,
      kind: "LINK",
      url: null,
      fileName: null,
      mimeType: null,
      checksum: null,
      sizeBytes: null,
    },
  ])("rejeita variação inválida %#", (attachment) => {
    expect(() => parseAttachmentOutput(attachment)).toThrow("Contrato de attachment inválido");
  });
});
