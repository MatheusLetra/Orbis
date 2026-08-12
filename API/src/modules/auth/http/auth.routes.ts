import type { FastifyInstance, FastifyReply } from "fastify";
import { ForbiddenError, UnauthorizedError } from "@/shared/errors/typed-errors";
import type { Login } from "../application/use-cases/login";
import type { Logout } from "../application/use-cases/logout";
import type { RefreshToken } from "../application/use-cases/refresh-token";

export interface AuthRouteOptions {
  login: Login;
  refreshToken: RefreshToken;
  logout: Logout;
  refreshCookie: {
    maxAgeSeconds: number;
    secure: boolean;
  };
  frontendOrigin: string;
}

const accessTokenResponse = {
  type: "object",
  properties: {
    accessToken: { type: "string" },
  },
  required: ["accessToken"],
} as const;

export const REFRESH_COOKIE_NAME = "orbis_refresh_token";
const REFRESH_COOKIE_PATH = "/auth";

export async function registerAuthRoutes(
  app: FastifyInstance,
  options: AuthRouteOptions,
): Promise<void> {
  app.post(
    "/auth/login",
    {
      schema: {
        tags: ["Auth"],
        description:
          "Autentica um usuário, retorna o access token e estabelece a sessão de refresh em cookie HttpOnly.",
        body: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
          required: ["email", "password"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              ...accessTokenResponse.properties,
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  name: { type: "string" },
                },
                required: ["id", "email", "name"],
              },
            },
            required: ["accessToken", "user"],
          },
        },
      },
    },
    async (request, reply) => {
      const output = await options.login.execute(request.body as never);
      setRefreshCookie(reply, output.refreshToken, options.refreshCookie);
      return reply.status(200).send({ accessToken: output.accessToken, user: output.user });
    },
  );

  app.post(
    "/auth/refresh",
    {
      schema: {
        tags: ["Auth"],
        security: [{ refreshCookie: [] }],
        description:
          "Rotaciona o refresh token recebido por cookie HttpOnly e retorna um novo access token.",
        response: {
          200: accessTokenResponse,
        },
      },
    },
    async (request, reply) => {
      assertTrustedOrigin(request.headers.origin, options.frontendOrigin);
      const refreshToken = request.cookies[REFRESH_COOKIE_NAME];
      if (!refreshToken) throw new UnauthorizedError("Refresh token não fornecido");
      const output = await options.refreshToken.execute({ refreshToken });
      setRefreshCookie(reply, output.refreshToken, options.refreshCookie);
      return reply.status(200).send({ accessToken: output.accessToken });
    },
  );

  app.post(
    "/auth/logout",
    {
      schema: {
        tags: ["Auth"],
        security: [{ refreshCookie: [] }],
        description: "Revoga a sessão de refresh recebida por cookie e remove o cookie.",
        response: { 204: { type: "null" } },
      },
    },
    async (request, reply) => {
      assertTrustedOrigin(request.headers.origin, options.frontendOrigin);
      const refreshToken = request.cookies[REFRESH_COOKIE_NAME];
      if (refreshToken) await options.logout.execute({ refreshToken });
      clearRefreshCookie(reply, options.refreshCookie.secure);
      return reply.status(204).send();
    },
  );
}

function assertTrustedOrigin(origin: string | undefined, frontendOrigin: string): void {
  if (origin !== undefined && origin !== frontendOrigin) {
    throw new ForbiddenError("Origem não autorizada para operação de sessão");
  }
}

function setRefreshCookie(
  reply: FastifyReply,
  refreshToken: string,
  config: AuthRouteOptions["refreshCookie"],
): void {
  reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: config.secure,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: config.maxAgeSeconds,
  });
}

function clearRefreshCookie(reply: FastifyReply, secure: boolean): void {
  reply.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
  });
}
