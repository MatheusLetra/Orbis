import { z } from "zod";
import { ValidationError } from "@/shared/errors/typed-errors";

const cursorSchema = z.object({ createdAt: z.iso.datetime(), id: z.uuid() }).strict();
export interface MessageCursor {
  createdAt: Date;
  id: string;
}

export function encodeMessageCursor(cursor: MessageCursor): string {
  return Buffer.from(
    JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id }),
  ).toString("base64url");
}

export function decodeMessageCursor(value: string): MessageCursor {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    if (Buffer.from(decoded).toString("base64url") !== value) throw new Error("non canonical");
    const parsed = cursorSchema.parse(JSON.parse(decoded));
    return { createdAt: new Date(parsed.createdAt), id: parsed.id };
  } catch {
    throw new ValidationError("Cursor inválido");
  }
}
