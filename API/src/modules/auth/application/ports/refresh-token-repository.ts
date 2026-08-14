export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  createdAt: Date;
}

export interface RefreshTokenRepository {
  create(token: RefreshTokenRecord): Promise<RefreshTokenRecord>;
  findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revoke(id: string, replacedById?: string): Promise<void>;
  rotate(currentId: string, replacement: RefreshTokenRecord): Promise<boolean>;
}
