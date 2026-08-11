import { eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { refreshTokens } from "@/infrastructure/database/schema";
import type {
  RefreshTokenRecord,
  RefreshTokenRepository,
} from "@/modules/auth/application/ports/refresh-token-repository";

export class DrizzleRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: Database) {}

  async create(token: RefreshTokenRecord): Promise<RefreshTokenRecord> {
    await this.db.insert(refreshTokens).values({
      id: token.id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      revokedAt: token.revokedAt,
      replacedById: token.replacedById,
    });

    return token;
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = (
      await this.db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash))
    )[0];

    return row
      ? {
          id: row.id,
          userId: row.userId,
          tokenHash: row.tokenHash,
          expiresAt: row.expiresAt,
          revokedAt: row.revokedAt,
          replacedById: row.replacedById,
          createdAt: row.createdAt,
        }
      : null;
  }

  async revoke(id: string, replacedById?: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), ...(replacedById ? { replacedById } : {}) })
      .where(eq(refreshTokens.id, id));
  }
}
