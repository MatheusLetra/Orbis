import { z } from "zod";

import type { Company } from "../../domain/entities/company.js";

export const createCompanySchema = z.object({
  name: z.string().trim().min(1, "Nome da empresa é obrigatório").max(200, "Nome muito longo"),
  timezone: z.string().trim().min(1).max(50).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const updateCompanySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Nome da empresa é obrigatório")
      .max(200, "Nome muito longo")
      .optional(),
    timezone: z.string().trim().min(1).max(50).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nenhum campo para atualizar",
  });

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export interface CompanyOutput {
  id: string;
  name: string;
  timezone: string;
  settings: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toCompanyOutput(company: Company): CompanyOutput {
  return {
    id: company.id,
    name: company.name,
    timezone: company.timezone,
    settings: company.settings,
    isActive: company.isActive,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}
