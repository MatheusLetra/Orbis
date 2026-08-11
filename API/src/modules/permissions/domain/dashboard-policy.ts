import type { Permission } from "@/modules/permissions/domain/permission";
import type { Role } from "@/modules/permissions/domain/role";

export const DASHBOARD_PERMISSIONS = [
  "kanban.manage",
  "timeline.manage",
  "tasks.create",
  "tasks.update",
  "tasks.delete",
] as const;

export type DashboardPermission = (typeof DASHBOARD_PERMISSIONS)[number];

export const DASHBOARD_SCOPE = ["company", "own"] as const;

export type DashboardScope = (typeof DASHBOARD_SCOPE)[number];

export interface DashboardPolicyProps {
  companyDefault: readonly DashboardPermission[];
  rolePermissions?: Partial<Record<Role, readonly DashboardPermission[]>>;
  userPermissions?: Readonly<Record<string, readonly DashboardPermission[]>>;
  userDenied?: Readonly<Record<string, readonly DashboardPermission[]>>;
  allowPersonalKanbanManagement?: boolean;
}

export class DashboardPolicy {
  private readonly companyDefault: readonly DashboardPermission[];
  private readonly rolePermissions: Partial<Record<Role, readonly DashboardPermission[]>>;
  private readonly userPermissions: Readonly<Record<string, readonly DashboardPermission[]>>;
  private readonly userDenied: Readonly<Record<string, readonly DashboardPermission[]>>;
  private readonly allowPersonalKanbanManagement: boolean;

  constructor(props: DashboardPolicyProps) {
    this.companyDefault = [...props.companyDefault];
    this.rolePermissions = props.rolePermissions ?? {};
    this.userPermissions = props.userPermissions ?? {};
    this.userDenied = props.userDenied ?? {};
    this.allowPersonalKanbanManagement = props.allowPersonalKanbanManagement ?? false;
  }

  resolveFor(role: string | null, userId: string): Permission[] {
    const denied = new Set(this.userDenied[userId] ?? []);
    const userGrants = this.userPermissions[userId] ?? [];
    const roleGrants = role ? (this.rolePermissions[role as Role] ?? []) : [];
    const merged = [...this.companyDefault, ...roleGrants, ...userGrants];

    return [...new Set(merged)].filter((permission) => !denied.has(permission));
  }

  canManageBoard(role: string | null, userId: string, scope: DashboardScope): boolean {
    const permissions = this.resolveFor(role, userId);

    if (permissions.includes("kanban.manage")) {
      return true;
    }

    return scope === "own" && this.allowPersonalKanbanManagement;
  }
}

export const DEFAULT_DASHBOARD_POLICY = new DashboardPolicy({
  companyDefault: [],
  rolePermissions: {
    ADMINISTRADOR: [...DASHBOARD_PERMISSIONS],
    GESTOR: [...DASHBOARD_PERMISSIONS],
    DESENVOLVEDOR: ["tasks.create", "tasks.update", "tasks.delete"],
    TESTADOR: ["tasks.update"],
  },
  userPermissions: {},
  userDenied: {},
  allowPersonalKanbanManagement: true,
});
