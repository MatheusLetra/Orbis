import type { FastifyInstance } from "fastify";
import type { CreateUser } from "@/modules/users/application/use-cases/create-user";

export interface UserRouteOptions {
  createUser: CreateUser;
}

export async function registerUserRoutes(
  app: FastifyInstance,
  options: UserRouteOptions,
): Promise<void> {
  app.post(
    "/users",
    {
      schema: {
        tags: ["Usuários"],
        description: "Cria um novo usuário (público).",
        body: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            name: { type: "string" },
            password: { type: "string", minLength: 8 },
          },
          required: ["email", "name", "password"],
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              email: { type: "string" },
              name: { type: "string" },
              isActive: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
            required: ["id", "email", "name", "isActive", "createdAt", "updatedAt"],
          },
        },
      },
    },
    async (request, reply) => {
      const output = await options.createUser.execute(request.body as never);
      return reply.status(201).send(output);
    },
  );
}
