import { z } from "zod";

import type { SystemVersion } from "@/modules/versions/domain/entities/system-version";

export const createSystemVersionSchema = z.object({
  version: z.string().trim().min(1, "Versão é obrigatória").max(50, "Versão muito longa"),
});

export type CreateSystemVersionInput = z.infer<typeof createSystemVersionSchema>;

export const updateSystemVersionSchema = z
  .object({
    version: z.string().trim().min(1, "Versão é obrigatória").max(50).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nenhum campo para atualizar",
  });

export type UpdateSystemVersionInput = z.infer<typeof updateSystemVersionSchema>;

export interface SystemVersionOutput {
  id: string;
  companyId: string;
  systemId: string;
  version: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toSystemVersionOutput(version: SystemVersion): SystemVersionOutput {
  return {
    id: version.id,
    companyId: version.companyId,
    systemId: version.systemId,
    version: version.version,
    isActive: version.isActive,
    createdAt: version.createdAt.toISOString(),
    updatedAt: version.updatedAt.toISOString(),
  };
}
