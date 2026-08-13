export const ATTACHMENT_KINDS = ["FILE", "LINK"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export type AttachmentOwner =
  | { type: "REQUISITION"; requisitionId: string }
  | { type: "TASK"; taskId: string };

export interface AttachmentOutput {
  id: string;
  companyId: string;
  owner: AttachmentOwner;
  kind: AttachmentKind;
  title: string | null;
  fileName: string | null;
  mimeType: string | null;
  checksum: string | null;
  sizeBytes: number | null;
  url: string | null;
  createdBy: string;
  createdAt: string;
}

export function parseAttachmentOutputs(value: unknown): AttachmentOutput[] {
  if (!Array.isArray(value)) throw new Error("Contrato de attachments inválido");
  return value.map(parseAttachmentValue);
}

export function parseAttachmentOutput(value: unknown): AttachmentOutput {
  return parseAttachmentOutputs([value])[0] as AttachmentOutput;
}

export function parseAttachmentRemoval(value: unknown): { id: string } {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error("Contrato de remoção de attachment inválido");
  }
  return { id: value.id };
}

function parseAttachmentValue(value: unknown): AttachmentOutput {
  if (!isRecord(value)) throw new Error("Contrato de attachment inválido");
  if (
    typeof value.id !== "string" ||
    typeof value.companyId !== "string" ||
    !isAttachmentOwner(value.owner) ||
    (value.kind !== "FILE" && value.kind !== "LINK") ||
    !nullableString(value.title) ||
    !nullableString(value.fileName) ||
    !nullableString(value.mimeType) ||
    !nullableString(value.checksum) ||
    !nullableInteger(value.sizeBytes) ||
    !nullableString(value.url) ||
    typeof value.createdBy !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    throw new Error("Contrato de attachment inválido");
  }

  if (value.kind === "FILE" && (value.url !== null || value.fileName === null)) {
    throw new Error("Contrato de attachment inválido");
  }
  if (
    value.kind === "LINK" &&
    (value.url === null ||
      value.fileName !== null ||
      value.mimeType !== null ||
      value.checksum !== null ||
      value.sizeBytes !== null)
  ) {
    throw new Error("Contrato de attachment inválido");
  }

  return value as unknown as AttachmentOutput;
}

function isAttachmentOwner(value: unknown): value is AttachmentOwner {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type === "TASK") return typeof value.taskId === "string";
  return value.type === "REQUISITION" && typeof value.requisitionId === "string";
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function nullableInteger(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
