import type { FastifyInstance } from "fastify";
import type { Login } from "../application/use-cases/login";
import type { Logout } from "../application/use-cases/logout";
import type { RefreshToken } from "../application/use-cases/refresh-token";

export interface AuthRouteOptions {
  login: Login;
  refreshToken: RefreshToken;
  logout: Logout;
}

const tokenPairResponse = {
  type: "object",
  properties: {
    accessToken: { type: "string" },
    refreshToken: { type: "string" },
  },
  required: ["accessToken", "refreshToken"],
} as const;

export async function registerAuthRoutes(
  app: FastifyInstance,
  options: AuthRouteOptions,
): Promise<void> {
  app.post(
    "/auth/login",
    {
      schema: {
        tags: ["Auth"],
        description: "Autentica um usuário e retorna access + refresh tokens.",
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
              ...tokenPairResponse.properties,
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
            required: ["accessToken", "refreshToken", "user"],
          },
        },
      },
    },
    async (request, reply) => {
      const output = await options.login.execute(request.body as never);
      return reply.status(200).send(output);
    },
  );

  app.post(
    "/auth/refresh",
    {
      schema: {
        tags: ["Auth"],
        description: "Rotaciona o refresh token (revoga o anterior) e emite novos tokens.",
        body: {
          type: "object",
          properties: { refreshToken: { type: "string" } },
          required: ["refreshToken"],
        },
        response: { 200: tokenPairResponse },
      },
    },
    async (request, reply) => {
      const output = await options.refreshToken.execute(request.body as never);
      return reply.status(200).send(output);
    },
  );

  app.post(
    "/auth/logout",
    {
      schema: {
        tags: ["Auth"],
        description: "Revoga o refresh token informado.",
        body: {
          type: "object",
          properties: { refreshToken: { type: "string" } },
          required: ["refreshToken"],
        },
        response: { 204: { type: "null" } },
      },
    },
    async (request, reply) => {
      await options.logout.execute(request.body as never);
      return reply.status(204).send();
    },
  );
}
