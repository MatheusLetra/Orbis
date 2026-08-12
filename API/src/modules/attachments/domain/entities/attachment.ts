import { Entity } from "@/shared/domain/entity";
import { BusinessRuleError } from "@/shared/errors/typed-errors";

export const ATTACHMENT_KINDS = ["FILE", "LINK"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
export type AttachmentMimeType = (typeof ATTACHMENT_MIME_TYPES)[number];

export type AttachmentOwner =
  | { readonly type: "REQUISITION"; readonly requisitionId: string }
  | { readonly type: "TASK"; readonly taskId: string };

interface AttachmentBaseProps {
  id: string;
  companyId: string;
  owner: AttachmentOwner;
  title: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface FileAttachmentProps extends AttachmentBaseProps {
  kind: "FILE";
  fileName: string;
  mimeType: AttachmentMimeType;
  checksum: string;
  sizeBytes: number;
  url: null;
}

export interface LinkAttachmentProps extends AttachmentBaseProps {
  kind: "LINK";
  url: string;
  fileName: null;
  mimeType: null;
  checksum: null;
  sizeBytes: null;
}

export type AttachmentProps = FileAttachmentProps | LinkAttachmentProps;

export interface CreateFileAttachmentData {
  companyId: string;
  owner: AttachmentOwner;
  title?: string;
  fileName: string;
  mimeType: string;
  checksum: string;
  sizeBytes: number;
  createdBy: string;
  createdAt?: Date;
}

export interface CreateLinkAttachmentData {
  companyId: string;
  owner: AttachmentOwner;
  title: string;
  url: string;
  createdBy: string;
  createdAt?: Date;
}

export class Attachment extends Entity<string> {
  private constructor(private readonly props: AttachmentProps) {
    super(props.id);
  }

  static createFile(data: CreateFileAttachmentData, id = crypto.randomUUID()): Attachment {
    const fileName = normalizeFileName(data.fileName, data.mimeType);
    const mimeType = assertMimeType(data.mimeType);

    return new Attachment({
      id,
      companyId: requiredText(data.companyId, "companyId"),
      owner: normalizeOwner(data.owner),
      kind: "FILE",
      title: normalizeOptionalTitle(data.title),
      fileName,
      mimeType,
      checksum: normalizeChecksum(data.checksum),
      sizeBytes: assertSize(data.sizeBytes),
      url: null,
      createdBy: requiredText(data.createdBy, "createdBy"),
      createdAt: data.createdAt ?? new Date(),
    });
  }

  static createLink(data: CreateLinkAttachmentData, id = crypto.randomUUID()): Attachment {
    return new Attachment({
      id,
      companyId: requiredText(data.companyId, "companyId"),
      owner: normalizeOwner(data.owner),
      kind: "LINK",
      title: normalizeRequiredTitle(data.title),
      url: normalizeUrl(data.url),
      fileName: null,
      mimeType: null,
      checksum: null,
      sizeBytes: null,
      createdBy: requiredText(data.createdBy, "createdBy"),
      createdAt: data.createdAt ?? new Date(),
    });
  }

  static restore(props: AttachmentProps): Attachment {
    const common = {
      id: requiredText(props.id, "id"),
      companyId: requiredText(props.companyId, "companyId"),
      owner: normalizeOwner(props.owner),
      createdBy: requiredText(props.createdBy, "createdBy"),
      createdAt: props.createdAt,
    };

    if (props.kind === "FILE") {
      if (props.url !== null) throw new BusinessRuleError("FILE não pode possuir URL");
      return new Attachment({
        ...common,
        kind: "FILE",
        title: normalizeOptionalTitle(props.title ?? undefined),
        fileName: normalizeFileName(props.fileName, props.mimeType),
        mimeType: assertMimeType(props.mimeType),
        checksum: normalizeChecksum(props.checksum),
        sizeBytes: assertSize(props.sizeBytes),
        url: null,
      });
    }

    if (props.kind === "LINK") {
      if (
        props.fileName !== null ||
        props.mimeType !== null ||
        props.checksum !== null ||
        props.sizeBytes !== null
      ) {
        throw new BusinessRuleError("LINK não pode possuir metadados de arquivo");
      }
      return new Attachment({
        ...common,
        kind: "LINK",
        title: normalizeRequiredTitle(props.title ?? ""),
        url: normalizeUrl(props.url),
        fileName: null,
        mimeType: null,
        checksum: null,
        sizeBytes: null,
      });
    }

    throw new BusinessRuleError("Tipo de anexo inválido");
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get owner(): AttachmentOwner {
    return { ...this.props.owner };
  }

  get kind(): AttachmentKind {
    return this.props.kind;
  }

  get title(): string | null {
    return this.props.title;
  }

  get createdBy(): string {
    return this.props.createdBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get fileName(): string | null {
    return this.props.kind === "FILE" ? this.props.fileName : null;
  }

  get mimeType(): AttachmentMimeType | null {
    return this.props.kind === "FILE" ? this.props.mimeType : null;
  }

  get checksum(): string | null {
    return this.props.kind === "FILE" ? this.props.checksum : null;
  }

  get sizeBytes(): number | null {
    return this.props.kind === "FILE" ? this.props.sizeBytes : null;
  }

  get url(): string | null {
    return this.props.kind === "LINK" ? this.props.url : null;
  }
}

export function normalizeOwner(owner: AttachmentOwner): AttachmentOwner {
  if (owner.type === "REQUISITION") {
    if (Object.keys(owner).some((key) => key !== "type" && key !== "requisitionId")) {
      throw new BusinessRuleError("Proprietário de anexo ambíguo");
    }
    return {
      type: "REQUISITION",
      requisitionId: requiredText(owner.requisitionId, "requisitionId"),
    };
  }

  if (owner.type === "TASK") {
    if (Object.keys(owner).some((key) => key !== "type" && key !== "taskId")) {
      throw new BusinessRuleError("Proprietário de anexo ambíguo");
    }
    return { type: "TASK", taskId: requiredText(owner.taskId, "taskId") };
  }

  throw new BusinessRuleError("Proprietário de anexo inválido");
}

export function assertMimeType(value: string): AttachmentMimeType {
  if ((ATTACHMENT_MIME_TYPES as readonly string[]).includes(value))
    return value as AttachmentMimeType;
  throw new BusinessRuleError("MIME type de anexo não permitido");
}

export function assertSize(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new BusinessRuleError("Tamanho de anexo inválido");
  }
  return value;
}

export function normalizeFileName(value: string, mimeType: string): string {
  const fileName = value.trim();
  assertTextLength(fileName, "fileName", 255);
  if (fileName.includes("/") || fileName.includes("\\") || [...fileName].some(isControlCharacter)) {
    throw new BusinessRuleError("fileName contém caracteres inválidos");
  }

  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  const extensions: Record<AttachmentMimeType, readonly string[]> = {
    "application/pdf": [".pdf"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/gif": [".gif"],
    "image/webp": [".webp"],
  };
  const allowed = extensions[assertMimeType(mimeType)];
  if (!allowed.includes(extension))
    throw new BusinessRuleError("Extensão incompatível com o MIME type");
  return fileName;
}

export function normalizeUrl(value: string): string {
  const input = value.trim();
  assertTextLength(input, "url", 2048);

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new BusinessRuleError("URL de anexo inválida");
  }
  if (!(url.protocol === "http:" || url.protocol === "https:") || url.username || url.password) {
    throw new BusinessRuleError("URL de anexo não permitida");
  }
  return url.toString();
}

export function normalizeOptionalTitle(value: string | undefined): string | null {
  if (value === undefined) return null;
  return normalizeTitle(value, false);
}

function normalizeRequiredTitle(value: string): string {
  return normalizeTitle(value, true) as string;
}

function normalizeTitle(value: string, required: boolean): string | null {
  const title = value.trim();
  if (!title && required) throw new BusinessRuleError("Título do anexo é obrigatório");
  if (!title) throw new BusinessRuleError("Título do anexo não pode ser vazio");
  assertTextLength(title, "title", 255);
  return title;
}

function requiredText(value: string, field: string): string {
  if (!value.trim()) throw new BusinessRuleError(`${field} é obrigatório`);
  return value.trim();
}

function assertTextLength(value: string, field: string, max: number): void {
  if (!value || value.length > max) throw new BusinessRuleError(`${field} inválido`);
}

function normalizeChecksum(value: string): string {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new BusinessRuleError("Checksum SHA-256 inválido");
  return value;
}

function isControlCharacter(value: string): boolean {
  const code = value.charCodeAt(0);
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
}
