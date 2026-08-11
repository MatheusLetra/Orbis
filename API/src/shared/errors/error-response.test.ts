import { describe, expect, it } from "vitest";
import { toErrorResponse } from "./error-response.js";
import { NotFoundError, ValidationError } from "./typed-errors.js";

describe("toErrorResponse", () => {
  it("converte um AppError em status e body estruturado", () => {
    const error = new ValidationError("Campo inválido", { details: { field: "email" } });

    const response = toErrorResponse(error);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Campo inválido",
        details: { field: "email" },
      },
    });
  });

  it("omite details quando não presentes", () => {
    const response = toErrorResponse(new NotFoundError("Não achei"));

    expect(response.body.error).toEqual({ code: "NOT_FOUND", message: "Não achei" });
    expect(response.body.error).not.toHaveProperty("details");
  });
});
