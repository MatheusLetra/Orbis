import {
  type AuditRecorder,
  NOOP_AUDIT_RECORDER,
} from "@/modules/audit/application/ports/audit-recorder";
import type { UseCase } from "@/shared/application/use-case";
import { ValidationError } from "@/shared/errors/typed-errors";
import { hashToken } from "@/shared/utils/hash-token";
import { type LogoutInput, logoutSchema } from "../dto/auth-dtos";
import type { RefreshTokenRepository } from "../ports/refresh-token-repository";
import type { TokenService } from "../ports/token-service";

export class Logout implements UseCase<LogoutInput, void> {
  constructor(
    private readonly tokenService: TokenService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly audit: AuditRecorder = NOOP_AUDIT_RECORDER,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    const parsed = logoutSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Refresh token inválido", {
        details: { issues: parsed.error.issues },
      });
    }

    try {
      await this.tokenService.verifyRefreshToken(parsed.data.refreshToken);
    } catch {
      return;
    }

    const record = await this.refreshTokenRepository.findByTokenHash(
      hashToken(parsed.data.refreshToken),
    );
    if (record && !record.revokedAt) {
      await this.refreshTokenRepository.revoke(record.id);
      await this.audit.record({
        companyId: null,
        actorUserId: record.userId,
        action: "AUTH_LOGOUT",
        entityType: "USER",
        entityId: record.userId,
        metadata: null,
      });
    }
  }
}
