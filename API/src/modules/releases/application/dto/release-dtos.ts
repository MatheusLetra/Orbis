import { z } from "zod";

import { RELEASE_CHANNELS, type Release } from "@/modules/releases/domain/entities/release";

export const createReleaseSchema = z.object({
  systemVersionId: z.string().uuid("systemVersionId inválido"),
  versionLabel: z
    .string()
    .trim()
    .min(1, "Rótulo da versão é obrigatório")
    .max(100, "Rótulo muito longo"),
  channel: z.enum(RELEASE_CHANNELS).optional(),
});

export type CreateReleaseInput = z.infer<typeof createReleaseSchema>;

export const publishReleaseSchema = z.object({
  artifactName: z
    .string()
    .trim()
    .min(1, "Nome do artefato é obrigatório")
    .max(200, "Nome muito longo"),
  contentBase64: z.string().min(1, "Conteúdo do artefato é obrigatório"),
});

export type PublishReleaseInput = z.infer<typeof publishReleaseSchema>;

export interface ReleaseOutput {
  id: string;
  companyId: string;
  systemVersionId: string;
  versionLabel: string;
  channel: string;
  status: string;
  artifactName: string | null;
  storageKey: string | null;
  checksum: string | null;
  sizeBytes: number | null;
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
}

export function toReleaseOutput(release: Release): ReleaseOutput {
  return {
    id: release.id,
    companyId: release.companyId,
    systemVersionId: release.systemVersionId,
    versionLabel: release.versionLabel,
    channel: release.channel,
    status: release.status,
    artifactName: release.artifactName,
    storageKey: release.storageKey,
    checksum: release.checksum,
    sizeBytes: release.sizeBytes,
    publishedAt: release.publishedAt?.toISOString() ?? null,
    createdBy: release.createdBy,
    createdAt: release.createdAt.toISOString(),
  };
}
