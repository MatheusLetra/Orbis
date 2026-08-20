import {
  COMPANY_CAPABILITY_NAMES,
  type CompanyCapability,
} from "@/features/companies/capabilities-contracts";

export type Permission = CompanyCapability;
export const ADMIN_PERMISSIONS = COMPANY_CAPABILITY_NAMES;
export const PERMISSION_LABELS: Record<Permission, string> = {
  "tasks.read": "Consultar tarefas",
  "tasks.create": "Criar tarefas",
  "tasks.update": "Editar tarefas",
  "tasks.delete": "Excluir tarefas",
  "kanban.manage": "Gerenciar Kanban",
  "timeline.manage": "Gerenciar timelines",
  "hours.register": "Registrar horas",
  "capacity.read": "Consultar capacidade",
  "company.read": "Consultar empresa",
  "company.update": "Editar empresa",
  "users.read": "Consultar usuários",
  "users.manage": "Gerenciar usuários",
  "permissions.manage": "Gerenciar permissões",
  "systems.read": "Consultar Systems",
  "systems.manage": "Gerenciar Systems",
  "versions.manage": "Gerenciar Versions",
  "releases.read": "Consultar Releases",
  "releases.manage": "Gerenciar Releases",
  "requisitions.read": "Consultar requisições",
  "requisitions.create": "Criar requisições",
  "requisitions.update": "Editar requisições",
  "requisitions.delete": "Excluir requisições",
  "notifications.manage": "Gerenciar notificações",
  "chat.use": "Usar chat",
  "audit.read": "Consultar auditoria",
};
export const DEFAULT_PERMISSIONS_BY_POSITION: Record<string, readonly Permission[]> = {
  ADMINISTRADOR: ADMIN_PERMISSIONS,
  GESTOR: ADMIN_PERMISSIONS,
  SUPORTE: [
    "company.read",
    "users.read",
    "systems.read",
    "releases.read",
    "requisitions.read",
    "tasks.read",
    "chat.use",
    "notifications.manage",
  ],
  TESTADOR: [
    "company.read",
    "systems.read",
    "releases.read",
    "requisitions.read",
    "tasks.read",
    "tasks.update",
    "hours.register",
    "chat.use",
  ],
  DESENVOLVEDOR: [
    "company.read",
    "systems.read",
    "releases.read",
    "requisitions.read",
    "requisitions.create",
    "requisitions.update",
    "tasks.read",
    "tasks.create",
    "tasks.update",
    "hours.register",
    "chat.use",
  ],
};

export interface AdminCompany {
  id: string;
  name: string;
  timezone: string;
  settings: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface CapacitySettings {
  companyId: string;
  dailyHoursPerDeveloper: number | null;
}
export interface AdminMember {
  membershipId: string;
  userId: string;
  email: string;
  name: string;
  position: string;
  permissions: Permission[];
  isActive: boolean;
}
export interface SoftwareSystem {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface SystemVersion {
  id: string;
  companyId: string;
  systemId: string;
  version: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface Requisition {
  id: string;
  companyId: string;
  number: number;
  title: string;
  description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "IN_PROGRESS" | "PAUSED" | "DONE" | "CANCELLED";
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
  assignees?: Array<{ userId: string; createdAt: string }>;
}
export interface Release {
  id: string;
  companyId: string;
  systemVersionId: string;
  versionLabel: string;
  channel: "STABLE" | "BETA";
  status: string;
  artifactName: string | null;
  artifactLocation: string | null;
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
}
export interface AuditItem {
  id: string;
  companyId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
export interface AuditPage {
  companyId: string;
  items: AuditItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

const requiredStrings = (value: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => typeof value[key] === "string");
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
function invalid(name: string): never {
  throw new Error(`Contrato de ${name} inválido`);
}
function parseList<T>(value: unknown, parser: (item: unknown) => T, name: string): T[] {
  if (!Array.isArray(value)) invalid(name);
  return value.map(parser);
}

export function parseCompany(value: unknown): AdminCompany {
  if (
    !record(value) ||
    !requiredStrings(value, ["id", "name", "timezone", "createdAt", "updatedAt"]) ||
    !record(value.settings) ||
    typeof value.isActive !== "boolean"
  )
    invalid("empresa");
  return value as unknown as AdminCompany;
}
export const parseCompanies = (value: unknown) => parseList(value, parseCompany, "empresas");
export function parseCapacitySettings(value: unknown): CapacitySettings {
  if (
    !record(value) ||
    typeof value.companyId !== "string" ||
    !(value.dailyHoursPerDeveloper === null || typeof value.dailyHoursPerDeveloper === "number")
  )
    invalid("configuração de capacidade");
  return value as unknown as CapacitySettings;
}
export function parseMember(value: unknown): AdminMember {
  if (
    !record(value) ||
    !requiredStrings(value, ["id", "userId", "email", "name", "position"]) ||
    !Array.isArray(value.permissions) ||
    !value.permissions.every((item) => ADMIN_PERMISSIONS.includes(item as Permission)) ||
    typeof value.userIsActive !== "boolean"
  )
    invalid("membro");
  return {
    membershipId: value.id as string,
    userId: value.userId as string,
    email: value.email as string,
    name: value.name as string,
    position: value.position as string,
    permissions: value.permissions as Permission[],
    isActive: (value.isActive ?? value.userIsActive) as boolean,
  };
}
export const parseMembers = (value: unknown) => parseList(value, parseMember, "membros");
export function parseSystem(value: unknown): SoftwareSystem {
  if (
    !record(value) ||
    !requiredStrings(value, ["id", "companyId", "name", "createdAt", "updatedAt"]) ||
    !(value.description === null || typeof value.description === "string") ||
    typeof value.isActive !== "boolean"
  )
    invalid("sistema");
  return value as unknown as SoftwareSystem;
}
export const parseSystems = (value: unknown) => parseList(value, parseSystem, "sistemas");
export function parseVersion(value: unknown): SystemVersion {
  if (
    !record(value) ||
    !requiredStrings(value, ["id", "companyId", "systemId", "version", "createdAt", "updatedAt"]) ||
    typeof value.isActive !== "boolean"
  )
    invalid("versão");
  return value as unknown as SystemVersion;
}
export const parseVersions = (value: unknown) => parseList(value, parseVersion, "versões");
export function parseRequisition(value: unknown): Requisition {
  if (
    !record(value) ||
    !requiredStrings(value, [
      "id",
      "companyId",
      "title",
      "priority",
      "status",
      "requesterId",
      "createdAt",
      "updatedAt",
    ]) ||
    typeof value.number !== "number"
  )
    invalid("requisição");
  return value as unknown as Requisition;
}
export const parseRequisitions = (value: unknown) =>
  parseList(value, parseRequisition, "requisições");
export function parseRelease(value: unknown): Release {
  if (
    !record(value) ||
    !requiredStrings(value, [
      "id",
      "companyId",
      "systemVersionId",
      "versionLabel",
      "channel",
      "status",
      "createdBy",
      "createdAt",
    ])
  )
    invalid("release");
  return value as unknown as Release;
}
export const parseReleases = (value: unknown) => parseList(value, parseRelease, "releases");
export function parseAuditPage(value: unknown): AuditPage {
  if (
    !record(value) ||
    typeof value.companyId !== "string" ||
    !Array.isArray(value.items) ||
    typeof value.hasMore !== "boolean" ||
    !(value.nextCursor === null || typeof value.nextCursor === "string")
  )
    invalid("auditoria");
  return value as unknown as AuditPage;
}
