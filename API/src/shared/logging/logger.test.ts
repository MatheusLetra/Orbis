import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { createLogger } from "./logger";

function captureLogs(): { lines: string[]; stream: Writable } {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  return { lines, stream };
}

describe("createLogger", () => {
  it("cria logs estruturados com serviço e ambiente", () => {
    const { lines, stream } = captureLogs();
    const logger = createLogger({ level: "info", environment: "test", destination: stream });

    logger.info({ hello: "world" }, "mensagem");

    const parsed = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(parsed).toMatchObject({
      service: "orbis-api",
      env: "test",
      msg: "mensagem",
      hello: "world",
      level: 30,
    });
  });

  it("redige campos sensíveis", () => {
    const { lines, stream } = captureLogs();
    const logger = createLogger({ level: "info", destination: stream });

    logger.info({ password: "supersecreto", token: "abc", userId: "u-1" }, "credenciais");

    const parsed = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(parsed.password).toBe("[REDACTED]");
    expect(parsed.token).toBe("[REDACTED]");
    expect(parsed.userId).toBe("u-1");
  });

  it("respeita o nível de log", () => {
    const { lines, stream } = captureLogs();
    const logger = createLogger({ level: "error", destination: stream });

    logger.info("não deve aparecer");
    logger.error("deve aparecer");

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({ msg: "deve aparecer", level: 50 });
  });
});
