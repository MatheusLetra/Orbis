import { and, eq, isNull } from "drizzle-orm";
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

  async rotate(currentId: string, replacement: RefreshTokenRecord): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const updated = await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.id, currentId), isNull(refreshTokens.revokedAt)))
        .returning({ id: refreshTokens.id });
      if (updated.length === 0) return false;
      await tx.insert(refreshTokens).values({
        id: replacement.id,
        userId: replacement.userId,
        tokenHash: replacement.tokenHash,
        expiresAt: replacement.expiresAt,
        revokedAt: replacement.revokedAt,
        replacedById: replacement.replacedById,
      });
      await tx
        .update(refreshTokens)
        .set({ replacedById: replacement.id })
        .where(eq(refreshTokens.id, currentId));
      return true;
    });
  }
}
