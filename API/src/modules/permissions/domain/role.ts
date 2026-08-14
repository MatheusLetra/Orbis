import { ALL_PERMISSIONS, type Permission } from "@/modules/permissions/domain/permission";

export const ROLES = ["ADMINISTRADOR", "GESTOR", "SUPORTE", "TESTADOR", "DESENVOLVEDOR"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMINISTRADOR: ALL_PERMISSIONS,
  GESTOR: [
    "company.read",
    "company.update",
    "users.read",
    "users.manage",
    "permissions.manage",
    "systems.read",
    "systems.manage",
    "versions.manage",
    "releases.manage",
    "releases.read",
    "requisitions.read",
    "requisitions.create",
    "requisitions.update",
    "requisitions.delete",
    "tasks.read",
    "tasks.create",
    "tasks.update",
    "tasks.delete",
    "kanban.manage",
    "timeline.manage",
    "capacity.read",
    "hours.register",
    "notifications.manage",
    "chat.use",
    "audit.read",
  ],
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

export function permissionsForRole(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function permissionsForPosition(position: string): Permission[] {
  return isRole(position) ? permissionsForRole(position) : [];
}
