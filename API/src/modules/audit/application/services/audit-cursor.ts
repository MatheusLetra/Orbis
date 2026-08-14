import { z } from "zod";
import type { AuditCursor } from "@/modules/audit/domain/repositories/audit-log-repository";
import { ValidationError } from "@/shared/errors/typed-errors";

const cursorSchema = z.object({ createdAt: z.string().datetime(), id: z.string().uuid() }).strict();

export function encodeAuditCursor(cursor: AuditCursor): string {
  return Buffer.from(
    JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id }),
    "utf8",
  ).toString("base64url");
}

export function decodeAuditCursor(value: string): AuditCursor {
  try {
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    return { createdAt: new Date(parsed.createdAt), id: parsed.id };
  } catch {
    throw new ValidationError("Cursor de auditoria inválido");
  }
}
