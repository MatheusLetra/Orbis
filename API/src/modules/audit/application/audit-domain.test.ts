import { describe, expect, it } from "vitest";
import {
  decodeAuditCursor,
  encodeAuditCursor,
} from "@/modules/audit/application/services/audit-cursor";
import { AuditLog } from "@/modules/audit/domain/entities/audit-log";
import { ValidationError } from "@/shared/errors/typed-errors";

const id = "11111111-1111-4111-8111-111111111111";

describe("AuditLog e cursor", () => {
  it("cria identificadores e timestamps no backend", () => {
    const log = AuditLog.create({
      companyId: null,
      actorUserId: id,
      action: "AUTH_LOGIN_SUCCEEDED",
      entityType: "USER",
      entityId: id,
      metadata: null,
    });
    expect(log.props.id).toBeTypeOf("string");
    expect(log.props.createdAt).toBeInstanceOf(Date);
  });

  it("codifica e decodifica o cursor sem perder a ordenação", () => {
    const createdAt = new Date("2026-08-14T12:00:00.000Z");
    const encoded = encodeAuditCursor({ createdAt, id });
    expect(decodeAuditCursor(encoded)).toEqual({ createdAt, id });
  });

  it("rejeita cursor adulterado", () => {
    expect(() => decodeAuditCursor("not-a-cursor")).toThrow(ValidationError);
  });
});
