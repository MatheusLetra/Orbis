import { randomUUID } from "node:crypto";
import type { UseCase } from "@/shared/application/use-case";
import { UnauthorizedError, ValidationError } from "@/shared/errors/typed-errors";
import { hashToken } from "@/shared/utils/hash-token";
import {
  type RefreshTokenInput,
  type RefreshTokenOutput,
  refreshTokenSchema,
} from "../dto/auth-dtos";
import type { RefreshTokenRepository } from "../ports/refresh-token-repository";
import type { TokenService } from "../ports/token-service";

export interface RefreshTokenConfig {
  refreshTokenTtlMs: number;
}

export class RefreshToken implements UseCase<RefreshTokenInput, RefreshTokenOutput> {
  constructor(
    private readonly tokenService: TokenService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly config: RefreshTokenConfig,
  ) {}

  async execute(input: RefreshTokenInput): Promise<RefreshTokenOutput> {
    const parsed = refreshTokenSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Refresh token inválido", {
        details: { issues: parsed.error.issues },
      });
    }

    const payload = await this.verifyToken(parsed.data.refreshToken);
    const record = await this.refreshTokenRepository.findByTokenHash(
      hashToken(parsed.data.refreshToken),
    );

    if (!record || record.revokedAt) {
      throw new UnauthorizedError("Refresh token inválido");
    }
    if (record.id !== payload.jti || record.userId !== payload.sub) {
      throw new UnauthorizedError("Refresh token inválido");
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError("Refresh token expirado");
    }

    const newJti = randomUUID();
    const accessToken = await this.tokenService.signAccessToken(record.userId);
    const newRefreshToken = await this.tokenService.signRefreshToken(record.userId, newJti);
    const now = new Date();

    await this.refreshTokenRepository.create({
      id: newJti,
      userId: record.userId,
      tokenHash: hashToken(newRefreshToken),
      expiresAt: new Date(now.getTime() + this.config.refreshTokenTtlMs),
      revokedAt: null,
      replacedById: null,
      createdAt: now,
    });
    await this.refreshTokenRepository.revoke(record.id, newJti);

    return { accessToken, refreshToken: newRefreshToken };
  }

  private async verifyToken(token: string) {
    try {
      return await this.tokenService.verifyRefreshToken(token);
    } catch {
      throw new UnauthorizedError("Refresh token inválido");
    }
  }
}
