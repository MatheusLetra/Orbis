import { describe, expect, it } from "vitest";
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "./typed-errors";

const cases = [
  { ErrorClass: NotFoundError, code: "NOT_FOUND", status: 404 },
  { ErrorClass: UnauthorizedError, code: "UNAUTHORIZED", status: 401 },
  { ErrorClass: ForbiddenError, code: "FORBIDDEN", status: 403 },
  { ErrorClass: ValidationError, code: "VALIDATION_ERROR", status: 400 },
  { ErrorClass: ConflictError, code: "CONFLICT", status: 409 },
  { ErrorClass: BusinessRuleError, code: "BUSINESS_RULE", status: 422 },
] as const;

describe("erros tipados", () => {
  it.each(cases)(
    "$ErrorClass expõe code $code e status $status",
    ({ ErrorClass, code, status }) => {
      const error = new ErrorClass("mensagem");

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(code);
      expect(error.statusCode).toBe(status);
      expect(error.message).toBe("mensagem");
    },
  );
});
