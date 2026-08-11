import { z } from "zod";

import type { System } from "@/modules/systems/domain/entities/system";

export const createSystemSchema = z.object({
  name: z.string().trim().min(1, "Nome do sistema é obrigatório").max(100, "Nome muito longo"),
  description: z.string().trim().max(1000, "Descrição muito longa").optional(),
});

export type CreateSystemInput = z.infer<typeof createSystemSchema>;

export const updateSystemSchema = z
  .object({
    name: z.string().trim().min(1, "Nome do sistema é obrigatório").max(100).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nenhum campo para atualizar",
  });

export type UpdateSystemInput = z.infer<typeof updateSystemSchema>;

export interface SystemOutput {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toSystemOutput(system: System): SystemOutput {
  return {
    id: system.id,
    companyId: system.companyId,
    name: system.name,
    description: system.description,
    isActive: system.isActive,
    createdAt: system.createdAt.toISOString(),
    updatedAt: system.updatedAt.toISOString(),
  };
}
