export const PERMISSIONS = [
  "company.read",
  "company.update",
  "users.read",
  "users.manage",
  "permissions.manage",
  "systems.read",
  "systems.manage",
  "versions.manage",
  "releases.manage",
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
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ALL_PERMISSIONS: readonly Permission[] = PERMISSIONS;

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function toPermissions(values: readonly string[]): Permission[] {
  return values.filter(isPermission);
}
