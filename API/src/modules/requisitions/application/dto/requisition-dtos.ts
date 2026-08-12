import { z } from "zod";

import {
  REQUISITION_PRIORITIES,
  REQUISITION_STATUSES,
  type Requisition,
} from "@/modules/requisitions/domain/entities/requisition";
import type { RequisitionAssignee } from "@/modules/requisitions/domain/entities/requisition-assignee";

export const createRequisitionSchema = z.object({
  title: z.string().trim().min(1, "Título da requisição é obrigatório"),
  description: z.string().trim().optional(),
  priority: z.enum(REQUISITION_PRIORITIES).optional(),
  responsibleId: z.string().uuid("responsibleId inválido").optional(),
  systemId: z.string().uuid("systemId inválido").optional(),
  systemVersionId: z.string().uuid("systemVersionId inválido").optional(),
  estimatedHours: z.number().optional(),
  startDate: z.date().optional(),
  plannedDeliveryDate: z.date().optional(),
});

export type CreateRequisitionInput = z.infer<typeof createRequisitionSchema>;

export const updateRequisitionSchema = z
  .object({
    title: z.string().trim().min(1, "Título da requisição é obrigatório").optional(),
    description: z.string().trim().nullable().optional(),
    priority: z.enum(REQUISITION_PRIORITIES).optional(),
    responsibleId: z.string().uuid("responsibleId inválido").nullable().optional(),
    systemId: z.string().uuid("systemId inválido").nullable().optional(),
    systemVersionId: z.string().uuid("systemVersionId inválido").nullable().optional(),
    estimatedHours: z.number().nullable().optional(),
    startDate: z.date().nullable().optional(),
    plannedDeliveryDate: z.date().nullable().optional(),
    deliveredAt: z.date().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nenhum campo para atualizar",
  });

export type UpdateRequisitionInput = z.infer<typeof updateRequisitionSchema>;

export const listRequisitionsSchema = z
  .object({
    status: z.enum(REQUISITION_STATUSES).optional(),
    priority: z.enum(REQUISITION_PRIORITIES).optional(),
    responsibleId: z.string().uuid("responsibleId inválido").optional(),
  })
  .strict();

export type ListRequisitionsInput = z.infer<typeof listRequisitionsSchema>;

export interface RequisitionOutput {
  id: string;
  companyId: string;
  number: number;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  requesterId: string;
  responsibleId: string | null;
  systemId: string | null;
  systemVersionId: string | null;
  estimatedHours: number | null;
  startDate: string | null;
  plannedDeliveryDate: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequisitionAssigneeOutput {
  userId: string;
  createdAt: string;
}

export interface RequisitionDetailOutput extends RequisitionOutput {
  assignees: RequisitionAssigneeOutput[];
}

export function toRequisitionAssigneeOutput(
  assignee: RequisitionAssignee,
): RequisitionAssigneeOutput {
  return {
    userId: assignee.userId,
    createdAt: assignee.createdAt.toISOString(),
  };
}

export function toRequisitionDetailOutput(
  requisition: Requisition,
  assignees: RequisitionAssigneeOutput[],
): RequisitionDetailOutput {
  return {
    ...toRequisitionOutput(requisition),
    assignees,
  };
}

export function toRequisitionOutput(requisition: Requisition): RequisitionOutput {
  return {
    id: requisition.id,
    companyId: requisition.companyId,
    number: requisition.number,
    title: requisition.title,
    description: requisition.description,
    priority: requisition.priority,
    status: requisition.status,
    requesterId: requisition.requesterId,
    responsibleId: requisition.responsibleId,
    systemId: requisition.systemId,
    systemVersionId: requisition.systemVersionId,
    estimatedHours: requisition.estimatedHours,
    startDate: requisition.startDate?.toISOString() ?? null,
    plannedDeliveryDate: requisition.plannedDeliveryDate?.toISOString() ?? null,
    deliveredAt: requisition.deliveredAt?.toISOString() ?? null,
    createdAt: requisition.createdAt.toISOString(),
    updatedAt: requisition.updatedAt.toISOString(),
  };
}
