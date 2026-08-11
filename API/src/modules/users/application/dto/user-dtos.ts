import { z } from "zod";

import type { User } from "@/modules/users/domain/entities/user";

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(320),
  name: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres").max(200),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export interface UserOutput {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toUserOutput(user: User): UserOutput {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
