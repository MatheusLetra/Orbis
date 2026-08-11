import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { JoseTokenService } from "./jose-token-service";

const ACCESS_SECRET = "test-access-secret-com-pelo-menos-32-caracteres-000";
const REFRESH_SECRET = "test-refresh-secret-com-pelo-menos-32-caracteres-000";

function build() {
  return new JoseTokenService({
    accessSecret: ACCESS_SECRET,
    refreshSecret: REFRESH_SECRET,
    accessTokenTtl: "15m",
    refreshTokenTtl: "30d",
  });
}

describe("JoseTokenService", () => {
  it("assina e verifica access token com subject", async () => {
    const service = build();
    const token = await service.signAccessToken("user-1");

    const payload = await service.verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
  });

  it("rejeita access token com assinatura inválida", async () => {
    const service = build();
    const other = new JoseTokenService({
      accessSecret: "outro-segredo-de-acesso-com-pelo-menos-32-car",
      refreshSecret: REFRESH_SECRET,
      accessTokenTtl: "15m",
      refreshTokenTtl: "30d",
    });
    const token = await other.signAccessToken("user-1");

    await expect(service.verifyAccessToken(token)).rejects.toThrow();
  });

  it("rejeita access token expirado", async () => {
    const service = build();
    const key = new TextEncoder().encode(ACCESS_SECRET);
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key);

    await expect(service.verifyAccessToken(expired)).rejects.toThrow();
  });

  it("rejeita access token sem subject", async () => {
    const service = build();
    const key = new TextEncoder().encode(ACCESS_SECRET);
    const noSubject = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(key);

    await expect(service.verifyAccessToken(noSubject)).rejects.toThrow();
  });

  it("assina e verifica refresh token com subject e jti", async () => {
    const service = build();
    const token = await service.signRefreshToken("user-1", "jti-1");

    const payload = await service.verifyRefreshToken(token);
    expect(payload).toEqual({ sub: "user-1", jti: "jti-1" });
  });

  it("rejeita refresh token sem jti", async () => {
    const service = build();
    const key = new TextEncoder().encode(REFRESH_SECRET);
    const noJti = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(key);

    await expect(service.verifyRefreshToken(noJti)).rejects.toThrow();
  });

  it("rejeita refresh token com assinatura inválida", async () => {
    const service = build();
    const other = new JoseTokenService({
      accessSecret: ACCESS_SECRET,
      refreshSecret: "outro-segredo-de-refresh-com-pelo-menos-32-car",
      accessTokenTtl: "15m",
      refreshTokenTtl: "30d",
    });
    const token = await other.signRefreshToken("user-1", "jti-1");

    await expect(service.verifyRefreshToken(token)).rejects.toThrow();
  });
});
