import { describe, expect, it } from "vitest";
import {
  decodeMessageCursor,
  encodeMessageCursor,
} from "@/modules/chat/application/dto/message-cursor";
import { Conversation, canonicalDirectKey } from "@/modules/chat/domain/entities/conversation";
import { Message } from "@/modules/chat/domain/entities/message";
import { ValidationError } from "@/shared/errors/typed-errors";

const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";

describe("chat domain", () => {
  it("gera directKey canônica e interna independentemente da ordem", () => {
    expect(canonicalDirectKey([B, A])).toBe(`${A}:${B}`);
    expect(Conversation.create(A, [A, B]).directKey).toBe(Conversation.create(A, [B, A]).directKey);
  });

  it("mantém o mesmo instante ao tocar a conversa para uma mensagem", () => {
    const at = new Date("2026-08-14T12:00:00.000Z");
    const conversation = Conversation.create(A, [A, B]);
    const message = Message.create(conversation.id, A, "oi", at);
    conversation.touch(message.createdAt);
    expect(conversation.updatedAt).toEqual(message.createdAt);
  });

  it("codifica cursor opaco base64url estrito e rejeita conteúdo inválido", () => {
    const cursor = { createdAt: new Date("2026-08-14T12:00:00.000Z"), id: A };
    expect(decodeMessageCursor(encodeMessageCursor(cursor))).toEqual(cursor);
    expect(() => decodeMessageCursor("bm90LWpzb24")).toThrow(ValidationError);
    expect(() => decodeMessageCursor("bm90LWpzb24=")).toThrow(ValidationError);
  });
});
