import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("aplica valores padrão quando variáveis não estão presentes", () => {
    const env = loadEnv({ NODE_ENV: "test" });
    expect(env.PORT).toBe(3333);
    expect(env.HOST).toBe("0.0.0.0");
  });

  it("lê variáveis fornecidas", () => {
    const env = loadEnv({ NODE_ENV: "production", PORT: 4000, HOST: "127.0.0.1" });
    expect(env.NODE_ENV).toBe("production");
    expect(env.PORT).toBe(4000);
    expect(env.HOST).toBe("127.0.0.1");
  });

  it("lança erro para configuração inválida", () => {
    expect(() => loadEnv({ NODE_ENV: "invalid-mode" as never })).toThrow(
      "Configuração de ambiente inválida",
    );
  });

  it("usa a URL de banco padrão quando DATABASE_URL não está presente", () => {
    const env = loadEnv({ NODE_ENV: "test" });
    expect(env.DATABASE_URL).toBe("postgres://postgres:postgres@localhost:5432/orbis");
  });

  it("lê a DATABASE_URL fornecida", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      DATABASE_URL: "postgres://user:pass@host:5432/orbis",
    });
    expect(env.DATABASE_URL).toBe("postgres://user:pass@host:5432/orbis");
  });

  it("usa LOG_LEVEL padrão info quando não presente", () => {
    const env = loadEnv({ NODE_ENV: "test" });
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("lê LOG_LEVEL fornecido", () => {
    const env = loadEnv({ NODE_ENV: "test", LOG_LEVEL: "debug" });
    expect(env.LOG_LEVEL).toBe("debug");
  });

  it("rejeita LOG_LEVEL inválido", () => {
    expect(() => loadEnv({ NODE_ENV: "test", LOG_LEVEL: "verboso" as never })).toThrow(
      "Configuração de ambiente inválida",
    );
  });
});
