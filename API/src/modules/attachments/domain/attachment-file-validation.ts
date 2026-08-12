import { createHash } from "node:crypto";

import {
  type AttachmentMimeType,
  assertMimeType,
  assertSize,
  normalizeFileName,
  normalizeOptionalTitle,
} from "@/modules/attachments/domain/entities/attachment";
import { BusinessRuleError } from "@/shared/errors/typed-errors";

export interface PreparedFileAttachmentMetadata {
  fileName: string;
  mimeType: AttachmentMimeType;
  checksum: string;
  sizeBytes: number;
  title: string | null;
}

export function detectAttachmentMimeType(data: Buffer): AttachmentMimeType {
  if (startsWith(data, Buffer.from("%PDF-"))) return "application/pdf";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "image/jpeg";
  }
  if (startsWith(data, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (startsWith(data, Buffer.from("GIF87a")) || startsWith(data, Buffer.from("GIF89a"))) {
    return "image/gif";
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  throw new BusinessRuleError("Conteúdo do anexo não reconhecido");
}

export function prepareFileAttachmentMetadata(
  data: Buffer,
  fileName: string,
  title?: string,
): PreparedFileAttachmentMetadata {
  if (data.length === 0) throw new BusinessRuleError("Arquivo de anexo vazio");
  const sizeBytes = assertSize(data.length);
  const mimeType = assertMimeType(detectAttachmentMimeType(data));

  return {
    fileName: normalizeFileName(fileName, mimeType),
    mimeType,
    checksum: createHash("sha256").update(data).digest("hex"),
    sizeBytes,
    title: normalizeOptionalTitle(title),
  };
}

function startsWith(data: Buffer, signature: Buffer): boolean {
  return data.length >= signature.length && data.subarray(0, signature.length).equals(signature);
}
