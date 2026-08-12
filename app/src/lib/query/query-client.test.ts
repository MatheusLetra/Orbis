import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/http/api-error";
import { createQueryClient, shouldRetryQuery } from "./query-client";

describe("query client", () => {
  it("não repete erros HTTP não transitórios", () => {
    expect(shouldRetryQuery(0, new ApiError({ status: 400, code: "BAD", message: "bad" }))).toBe(
      false,
    );
    expect(shouldRetryQuery(0, new ApiError({ status: 401, code: "AUTH", message: "auth" }))).toBe(
      false,
    );
    expect(
      shouldRetryQuery(0, new ApiError({ status: 403, code: "FORBIDDEN", message: "no" })),
    ).toBe(false);
    expect(
      shouldRetryQuery(0, new ApiError({ status: 404, code: "NOT_FOUND", message: "no" })),
    ).toBe(false);
    expect(shouldRetryQuery(0, new ApiError({ status: 422, code: "RULE", message: "no" }))).toBe(
      false,
    );
  });

  it("limita retries transitórios a duas tentativas", () => {
    expect(shouldRetryQuery(0, new ApiError({ status: 500, code: "SERVER", message: "no" }))).toBe(
      true,
    );
    expect(shouldRetryQuery(1, new ApiError({ status: 503, code: "SERVER", message: "no" }))).toBe(
      true,
    );
    expect(shouldRetryQuery(2, new ApiError({ status: 503, code: "SERVER", message: "no" }))).toBe(
      false,
    );
    expect(shouldRetryQuery(2, new Error("network"))).toBe(false);
    expect(createQueryClient().getDefaultOptions().queries?.staleTime).toBe(30_000);
  });
});
