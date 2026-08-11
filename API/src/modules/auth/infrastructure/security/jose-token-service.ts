import { jwtVerify, SignJWT } from "jose";
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenService,
} from "@/modules/auth/application/ports/token-service";

export interface JoseTokenServiceOptions {
  accessSecret: string;
  refreshSecret: string;
  accessTokenTtl: string;
  refreshTokenTtl: string;
}

export class JoseTokenService implements TokenService {
  private readonly accessKey: Uint8Array;
  private readonly refreshKey: Uint8Array;

  constructor(private readonly options: JoseTokenServiceOptions) {
    this.accessKey = new TextEncoder().encode(options.accessSecret);
    this.refreshKey = new TextEncoder().encode(options.refreshSecret);
  }

  async signAccessToken(userId: string): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(this.options.accessTokenTtl)
      .sign(this.accessKey);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const { payload } = await jwtVerify(token, this.accessKey);
    if (typeof payload.sub !== "string") {
      throw new Error("Token sem subject");
    }
    return { sub: payload.sub };
  }

  async signRefreshToken(userId: string, jti: string): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(this.options.refreshTokenTtl)
      .sign(this.refreshKey);
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const { payload } = await jwtVerify(token, this.refreshKey);
    if (typeof payload.sub !== "string" || typeof payload.jti !== "string") {
      throw new Error("Token sem subject/jti");
    }
    return { sub: payload.sub, jti: payload.jti };
  }
}
