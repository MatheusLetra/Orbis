import { randomUUID } from "node:crypto";
import {
  type AuditRecorder,
  NOOP_AUDIT_RECORDER,
} from "@/modules/audit/application/ports/audit-recorder";
import type { PasswordHasher } from "@/modules/users/application/ports/password-hasher";
import type { UserRepository } from "@/modules/users/domain/repositories/user-repository";
import type { UseCase } from "@/shared/application/use-case";
import { UnauthorizedError, ValidationError } from "@/shared/errors/typed-errors";
import { hashToken } from "@/shared/utils/hash-token";
import { type LoginInput, type LoginOutput, loginSchema } from "../dto/auth-dtos";
import type { RefreshTokenRepository } from "../ports/refresh-token-repository";
import type { TokenService } from "../ports/token-service";

export interface AuthConfig {
  refreshTokenTtlMs: number;
}

export class Login implements UseCase<LoginInput, LoginOutput> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly config: AuthConfig,
    private readonly audit: AuditRecorder = NOOP_AUDIT_RECORDER,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Credenciais inválidas", {
        details: { issues: parsed.error.issues },
      });
    }

    const user = await this.userRepository.findByEmail(parsed.data.email);
    if (!user) {
      throw new UnauthorizedError("Credenciais inválidas");
    }

    const valid = await this.passwordHasher.verify(parsed.data.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("Credenciais inválidas");
    }

    if (!user.isActive) {
      throw new UnauthorizedError("Usuário inativo");
    }

    const { accessToken, refreshToken } = await this.issueTokens(user.id);

    await this.audit.record({
      companyId: null,
      actorUserId: user.id,
      action: "AUTH_LOGIN_SUCCEEDED",
      entityType: "USER",
      entityId: user.id,
      metadata: null,
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  private async issueTokens(userId: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const jti = randomUUID();
    const accessToken = await this.tokenService.signAccessToken(userId);
    const refreshToken = await this.tokenService.signRefreshToken(userId, jti);
    const now = new Date();

    await this.refreshTokenRepository.create({
      id: jti,
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(now.getTime() + this.config.refreshTokenTtlMs),
      revokedAt: null,
      replacedById: null,
      createdAt: now,
    });

    return { accessToken, refreshToken };
  }
}
