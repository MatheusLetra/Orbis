import { describe, expect, it } from "vitest";
import {
  detectAttachmentMimeType,
  prepareFileAttachmentMetadata,
} from "@/modules/attachments/domain/attachment-file-validation";
import {
  Attachment,
  type AttachmentOwner,
  type AttachmentProps,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "@/modules/attachments/domain/entities/attachment";
import { BusinessRuleError } from "@/shared/errors/typed-errors";

const requisitionOwner: AttachmentOwner = { type: "REQUISITION", requisitionId: "req-1" };
const taskOwner: AttachmentOwner = { type: "TASK", taskId: "task-1" };
const createdAt = new Date("2026-08-12T10:00:00Z");

function pdfBuffer(size = 5): Buffer {
  const data = Buffer.alloc(size);
  data.write("%PDF-");
  return data;
}

function fileData(overrides: Partial<Parameters<typeof Attachment.createFile>[0]> = {}) {
  return {
    companyId: "company-1",
    owner: requisitionOwner,
    fileName: "manual.pdf",
    mimeType: "application/pdf",
    checksum: "a".repeat(64),
    sizeBytes: 5,
    createdBy: "user-1",
    createdAt,
    ...overrides,
  };
}

function linkData(overrides: Partial<Parameters<typeof Attachment.createLink>[0]> = {}) {
  return {
    companyId: "company-1",
    owner: taskOwner,
    title: "  Documentação  ",
    url: "https://example.com/docs",
    createdBy: "user-1",
    createdAt,
    ...overrides,
  };
}

describe("Attachment", () => {
  it("cria FILE com owner de requisição e metadados", () => {
    const attachment = Attachment.createFile(fileData(), "attachment-1");

    expect(attachment.id).toBe("attachment-1");
    expect(attachment.kind).toBe("FILE");
    expect(attachment.owner).toEqual(requisitionOwner);
    expect(attachment.fileName).toBe("manual.pdf");
    expect(attachment.mimeType).toBe("application/pdf");
    expect(attachment.checksum).toBe("a".repeat(64));
    expect(attachment.sizeBytes).toBe(5);
    expect(attachment.url).toBeNull();
    expect(attachment.title).toBeNull();
  });

  it("cria LINK com owner de tarefa e normaliza título e URL", () => {
    const attachment = Attachment.createLink(linkData(), "attachment-2");

    expect(attachment.kind).toBe("LINK");
    expect(attachment.owner).toEqual(taskOwner);
    expect(attachment.title).toBe("Documentação");
    expect(attachment.url).toBe("https://example.com/docs");
    expect(attachment.fileName).toBeNull();
    expect(attachment.mimeType).toBeNull();
    expect(attachment.checksum).toBeNull();
    expect(attachment.sizeBytes).toBeNull();
  });

  it("rejeita owner ambíguo ou desconhecido", () => {
    expect(() =>
      Attachment.createFile(fileData({ owner: { type: "REQUISITION", requisitionId: "" } })),
    ).toThrow(BusinessRuleError);
    expect(() =>
      Attachment.createFile(
        fileData({
          owner: { type: "REQUISITION", requisitionId: "req-1", taskId: "task-1" } as never,
        }),
      ),
    ).toThrow(BusinessRuleError);
    expect(() => Attachment.createFile(fileData({ owner: { type: "OTHER" } as never }))).toThrow(
      BusinessRuleError,
    );
  });

  it("restaura FILE e LINK preservando identidade e data", () => {
    const file = Attachment.createFile(fileData(), "file-1");
    const link = Attachment.createLink(linkData(), "link-1");

    const restoredFile = Attachment.restore({
      id: file.id,
      companyId: file.companyId,
      owner: file.owner,
      kind: "FILE",
      title: file.title,
      fileName: file.fileName as string,
      mimeType: file.mimeType as "application/pdf",
      checksum: file.checksum as string,
      sizeBytes: file.sizeBytes as number,
      url: null,
      createdBy: file.createdBy,
      createdAt: file.createdAt,
    });
    const restoredLink = Attachment.restore({
      id: link.id,
      companyId: link.companyId,
      owner: link.owner,
      kind: "LINK",
      title: link.title,
      url: link.url as string,
      fileName: null,
      mimeType: null,
      checksum: null,
      sizeBytes: null,
      createdBy: link.createdBy,
      createdAt: link.createdAt,
    });

    expect(restoredFile.id).toBe(file.id);
    expect(restoredFile.createdAt).toBe(createdAt);
    expect(restoredLink.id).toBe(link.id);
    expect(restoredLink.url).toBe(link.url);
  });

  it("rejeita estados FILE e LINK inconsistentes no restore", () => {
    const file = fileData() as never as AttachmentProps;
    expect(() =>
      Attachment.restore({ ...file, id: "file", kind: "FILE", url: "https://invalid" } as never),
    ).toThrow(BusinessRuleError);
    expect(() =>
      Attachment.restore({
        ...linkData(),
        id: "link",
        kind: "LINK",
        fileName: "file.pdf",
        mimeType: null,
        checksum: null,
        sizeBytes: null,
      } as never),
    ).toThrow(BusinessRuleError);
  });

  it.each(["", "   "])("rejeita title FILE vazio informado: %j", (title) => {
    expect(() => Attachment.createFile(fileData({ title }))).toThrow(BusinessRuleError);
  });

  it.each(["", "   "])("rejeita title LINK vazio: %j", (title) => {
    expect(() => Attachment.createLink(linkData({ title }))).toThrow(BusinessRuleError);
  });

  it("rejeita title acima de 255 caracteres", () => {
    expect(() => Attachment.createFile(fileData({ title: "a".repeat(256) }))).toThrow(
      BusinessRuleError,
    );
    expect(() => Attachment.createLink(linkData({ title: "a".repeat(256) }))).toThrow(
      BusinessRuleError,
    );
  });

  it.each([
    "",
    "   ",
    "a/b.pdf",
    "a\\b.pdf",
    `a${String.fromCharCode(0)}.pdf`,
    `a${String.fromCharCode(7)}.pdf`,
  ])("rejeita fileName inválido: %j", (fileName) =>
    expect(() => Attachment.createFile(fileData({ fileName }))).toThrow(BusinessRuleError),
  );

  it("rejeita fileName acima de 255 e extensão incompatível", () => {
    expect(() => Attachment.createFile(fileData({ fileName: `${"a".repeat(252)}.pdf` }))).toThrow(
      BusinessRuleError,
    );
    expect(() => Attachment.createFile(fileData({ fileName: "manual.png" }))).toThrow(
      BusinessRuleError,
    );
  });

  it.each([
    ["application/pdf", "manual.PDF"],
    ["image/jpeg", "photo.JPG"],
    ["image/jpeg", "photo.jpeg"],
    ["image/png", "photo.png"],
    ["image/gif", "photo.gif"],
    ["image/webp", "photo.webp"],
  ] as const)("aceita extensão %s para %s", (mimeType, fileName) => {
    expect(Attachment.createFile(fileData({ mimeType, fileName })).fileName).toBe(fileName);
  });

  it("rejeita tamanho inválido", () => {
    expect(() => Attachment.createFile(fileData({ sizeBytes: 0 }))).toThrow(BusinessRuleError);
    expect(() =>
      Attachment.createFile(fileData({ sizeBytes: MAX_ATTACHMENT_SIZE_BYTES + 1 })),
    ).toThrow(BusinessRuleError);
  });

  it("não expõe métodos de alteração", () => {
    const attachment = Attachment.createFile(fileData());
    expect("rename" in attachment).toBe(false);
    expect("changeUrl" in attachment).toBe(false);
    expect("changeOwner" in attachment).toBe(false);
  });
});

describe("Attachment file validation", () => {
  it.each([
    ["application/pdf", Buffer.from("%PDF-")],
    ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff])],
    ["image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["image/gif", Buffer.from("GIF87a")],
    ["image/gif", Buffer.from("GIF89a")],
    ["image/webp", Buffer.from("RIFFxxxxWEBP")],
  ] as const)("detecta %s por magic bytes", (expected, data) => {
    expect(detectAttachmentMimeType(data)).toBe(expected);
  });

  it("rejeita conteúdo desconhecido", () => {
    expect(() => detectAttachmentMimeType(Buffer.from("unknown"))).toThrow(BusinessRuleError);
  });

  it("prepara metadata pelo conteúdo real, sem confiar em metadata do cliente", () => {
    const metadata = prepareFileAttachmentMetadata(pdfBuffer(), "  manual.PDF  ", "  Guia  ");

    expect(metadata).toEqual({
      fileName: "manual.PDF",
      mimeType: "application/pdf",
      checksum: "38523c087796e5d5dd1cf9bad1fb026781a838dd9dd2cf8af58b9f6502a46778",
      sizeBytes: 5,
      title: "Guia",
    });
  });

  it("calcula SHA-256 determinístico e diferente para conteúdo diferente", () => {
    const first = prepareFileAttachmentMetadata(pdfBuffer(), "a.pdf");
    const second = prepareFileAttachmentMetadata(pdfBuffer(), "a.pdf");
    const changed = prepareFileAttachmentMetadata(Buffer.from("%PDF-X"), "a.pdf");

    expect(first.checksum).toBe(second.checksum);
    expect(first.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(first.checksum).not.toBe(changed.checksum);
  });

  it("rejeita buffer vazio e acima de 10 MB, mas aceita exatamente 10 MB", () => {
    expect(() => prepareFileAttachmentMetadata(Buffer.alloc(0), "a.pdf")).toThrow(
      BusinessRuleError,
    );
    const maximum = Buffer.alloc(MAX_ATTACHMENT_SIZE_BYTES);
    maximum.write("%PDF-");
    expect(prepareFileAttachmentMetadata(maximum, "a.pdf").sizeBytes).toBe(
      MAX_ATTACHMENT_SIZE_BYTES,
    );
    const tooLarge = Buffer.alloc(MAX_ATTACHMENT_SIZE_BYTES + 1);
    tooLarge.write("%PDF-");
    expect(() => prepareFileAttachmentMetadata(tooLarge, "a.pdf")).toThrow(BusinessRuleError);
  });

  it("valida URL de LINK e normaliza sua representação", () => {
    expect(Attachment.createLink(linkData({ url: "  HTTPS://Example.COM:443/docs  " })).url).toBe(
      "https://example.com/docs",
    );
    expect(Attachment.createLink(linkData({ url: "http://example.com" })).url).toBe(
      "http://example.com/",
    );
    expect(() => Attachment.createLink(linkData({ url: "ftp://example.com" }))).toThrow(
      BusinessRuleError,
    );
    expect(() => Attachment.createLink(linkData({ url: "https://user:pass@example.com" }))).toThrow(
      BusinessRuleError,
    );
    expect(() => Attachment.createLink(linkData({ url: "invalid" }))).toThrow(BusinessRuleError);
    expect(() =>
      Attachment.createLink(linkData({ url: `https://example.com/${"a".repeat(2041)}` })),
    ).toThrow(BusinessRuleError);
  });
});
