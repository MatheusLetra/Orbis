import { describe, expect, it } from "vitest";
import { AppError } from "./app-error.js";

class FakeError extends AppError {
  readonly code = "FAKE";
  readonly statusCode = 418;
}

describe("AppError", () => {
  it("carrega mensagem, código e status HTTP", () => {
    const error = new FakeError("mensagem");

    expect(error.message).toBe("mensagem");
    expect(error.code).toBe("FAKE");
    expect(error.statusCode).toBe(418);
    expect(error.name).toBe("FakeError");
    expect(error).toBeInstanceOf(Error);
  });

  it("carrega detalhes e causa quando fornecidos", () => {
    const cause = new Error("causa");
    const error = new FakeError("mensagem", { details: { field: "x" }, cause });

    expect(error.details).toEqual({ field: "x" });
    expect(error.cause).toBe(cause);
  });

  it("não define detalhes nem causa quando omitidos", () => {
    const error = new FakeError("mensagem");

    expect(error.details).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });
});
