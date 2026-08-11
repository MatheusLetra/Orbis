export interface AccessTokenPayload {
  sub: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export interface TokenService {
  signAccessToken(userId: string): Promise<string>;
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
  signRefreshToken(userId: string, jti: string): Promise<string>;
  verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
}
