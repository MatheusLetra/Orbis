import { describe, expect, it } from "vitest";
import { User } from "@/modules/users/domain/entities/user";
import { UnauthorizedError, ValidationError } from "@/shared/errors/typed-errors";
import { hashToken } from "@/shared/utils/hash-token";
import {
  fakePasswordHasher,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
} from "@/test/fakes/identity-fakes";
import { JoseTokenService } from "../../infrastructure/security/jose-token-service";
import { Login } from "./login";
import { Logout } from "./logout";
import { RefreshToken } from "./refresh-token";

const ACCESS_SECRET = "test-access-secret-com-pelo-menos-32-caracteres-000";
const REFRESH_SECRET = "test-refresh-secret-com-pelo-menos-32-caracteres-000";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function build() {
  const users = new InMemoryUserRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const tokenService = new JoseTokenService({
    accessSecret: ACCESS_SECRET,
    refreshSecret: REFRESH_SECRET,
    accessTokenTtl: "15m",
    refreshTokenTtl: "30d",
  });
  const login = new Login(users, fakePasswordHasher, tokenService, refreshTokens, {
    refreshTokenTtlMs: TTL_MS,
  });
  const refreshToken = new RefreshToken(tokenService, refreshTokens, {
    refreshTokenTtlMs: TTL_MS,
  });
  const logout = new Logout(tokenService, refreshTokens);
  return { users, refreshTokens, tokenService, login, refreshToken, logout };
}

async function seedUser(users: InMemoryUserRepository, email = "ana@orbis.io") {
  return users.create(
    User.create({
      email,
      name: "Ana",
      passwordHash: await fakePasswordHasher.hash("senha-secreta"),
    }),
  );
}

describe("Login", () => {
  it("autentica e emite access + refresh, salvando o refresh com hash", async () => {
    const { users, refreshTokens, login } = build();
    await seedUser(users);

    const output = await login.execute({ email: "ana@orbis.io", password: "senha-secreta" });

    expect(output.accessToken).toBeTypeOf("string");
    expect(output.refreshToken).toBeTypeOf("string");
    expect(output.user).toMatchObject({ email: "ana@orbis.io", name: "Ana" });

    const record = await refreshTokens.findByTokenHash(hashToken(output.refreshToken));
    expect(record).not.toBeNull();
    expect(record?.userId).toBe(output.user.id);
    expect(record?.revokedAt).toBeNull();
  });

  it("lança UnauthorizedError para e-mail inexistente", async () => {
    const { login } = build();
    await expect(
      login.execute({ email: "x@orbis.io", password: "senha-secreta" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("lança UnauthorizedError para senha incorreta", async () => {
    const { users, login } = build();
    await seedUser(users);
    await expect(
      login.execute({ email: "ana@orbis.io", password: "senha-errada" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("lança UnauthorizedError para usuário inativo", async () => {
    const { users, login } = build();
    const user = await seedUser(users);
    user.deactivate();

    await expect(
      login.execute({ email: "ana@orbis.io", password: "senha-secreta" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("lança ValidationError para entrada inválida", async () => {
    const { login } = build();
    await expect(login.execute({ email: "invalido", password: "" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("RefreshToken", () => {
  it("rotaciona o refresh token e revoga o anterior", async () => {
    const { users, refreshTokens, login, refreshToken } = build();
    const user = await seedUser(users);
    const first = await login.execute({ email: "ana@orbis.io", password: "senha-secreta" });

    const second = await refreshToken.execute({ refreshToken: first.refreshToken });

    expect(second.accessToken).toBeTypeOf("string");
    expect(second.refreshToken).not.toBe(first.refreshToken);

    const oldRecord = await refreshTokens.findByTokenHash(hashToken(first.refreshToken));
    expect(oldRecord?.revokedAt).not.toBeNull();
    expect(oldRecord?.replacedById).toBeTypeOf("string");

    const newRecord = await refreshTokens.findByTokenHash(hashToken(second.refreshToken));
    expect(newRecord?.userId).toBe(user.id);
  });

  it("lança UnauthorizedError para token já revogado", async () => {
    const { users, login, refreshToken } = build();
    await seedUser(users);
    const first = await login.execute({ email: "ana@orbis.io", password: "senha-secreta" });
    await refreshToken.execute({ refreshToken: first.refreshToken });

    await expect(refreshToken.execute({ refreshToken: first.refreshToken })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("lança UnauthorizedError para token desconhecido no repositório", async () => {
    const { users, tokenService, login, refreshToken } = build();
    await seedUser(users);
    await login.execute({ email: "ana@orbis.io", password: "senha-secreta" });

    const forged = await tokenService.signRefreshToken("ana@orbis.io", "jti-inexistente");

    await expect(refreshToken.execute({ refreshToken: forged })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("lança UnauthorizedError para refresh token expirado", async () => {
    const { users, refreshTokens, tokenService, refreshToken } = build();
    const user = await seedUser(users);
    const jti = "jti-expirado";
    const expiredToken = await tokenService.signRefreshToken(user.id, jti);
    await refreshTokens.create({
      id: jti,
      userId: user.id,
      tokenHash: hashToken(expiredToken),
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      replacedById: null,
      createdAt: new Date(),
    });

    await expect(refreshToken.execute({ refreshToken: expiredToken })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("lança UnauthorizedError para token malformado", async () => {
    const { refreshToken } = build();
    await expect(refreshToken.execute({ refreshToken: "token-invalido" })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("lança ValidationError para entrada inválida", async () => {
    const { refreshToken } = build();
    await expect(refreshToken.execute({ refreshToken: "" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("Logout", () => {
  it("revoga o refresh token informado", async () => {
    const { users, refreshTokens, login, logout } = build();
    await seedUser(users);
    const { refreshToken } = await login.execute({
      email: "ana@orbis.io",
      password: "senha-secreta",
    });

    await logout.execute({ refreshToken });

    const record = await refreshTokens.findByTokenHash(hashToken(refreshToken));
    expect(record?.revokedAt).not.toBeNull();
  });

  it("é idempotente para token inválido", async () => {
    const { logout } = build();
    await expect(logout.execute({ refreshToken: "token-invalido" })).resolves.toBeUndefined();
  });

  it("não revoga duas vezes o mesmo token", async () => {
    const { users, refreshTokens, login, logout } = build();
    await seedUser(users);
    const { refreshToken } = await login.execute({
      email: "ana@orbis.io",
      password: "senha-secreta",
    });

    await logout.execute({ refreshToken });
    await logout.execute({ refreshToken });

    const record = await refreshTokens.findByTokenHash(hashToken(refreshToken));
    expect(record?.revokedAt).not.toBeNull();
  });

  it("lança ValidationError para entrada inválida", async () => {
    const { logout } = build();
    await expect(logout.execute({ refreshToken: "" })).rejects.toBeInstanceOf(ValidationError);
  });
});
