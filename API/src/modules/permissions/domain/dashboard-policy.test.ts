import { describe, expect, it } from "vitest";
import {
  DASHBOARD_PERMISSIONS,
  DashboardPolicy,
  DEFAULT_DASHBOARD_POLICY,
} from "@/modules/permissions/domain/dashboard-policy";

describe("DashboardPolicy", () => {
  it("resolve pela política padrão da empresa quando não há função nem usuário", () => {
    const policy = new DashboardPolicy({ companyDefault: ["tasks.update"] });

    expect(policy.resolveFor(null, "u1")).toEqual(["tasks.update"]);
  });

  it("soma permissões por função sobre o padrão da empresa", () => {
    const policy = new DashboardPolicy({
      companyDefault: ["tasks.update"],
      rolePermissions: { DESENVOLVEDOR: ["tasks.create", "tasks.delete"] },
    });

    expect(policy.resolveFor("DESENVOLVEDOR", "u1")).toEqual([
      "tasks.update",
      "tasks.create",
      "tasks.delete",
    ]);
  });

  it("permissão específica de usuário soma sobre função e empresa", () => {
    const policy = new DashboardPolicy({
      companyDefault: [],
      rolePermissions: { GESTOR: ["kanban.manage"] },
      userPermissions: { u1: ["timeline.manage"] },
    });

    expect(policy.resolveFor("GESTOR", "u1")).toEqual(["kanban.manage", "timeline.manage"]);
  });

  it("negação específica de usuário remove permissões (precedência máxima)", () => {
    const policy = new DashboardPolicy({
      companyDefault: ["kanban.manage", "tasks.update"],
      rolePermissions: { GESTOR: ["tasks.create"] },
      userPermissions: { u1: ["timeline.manage"] },
      userDenied: { u1: ["kanban.manage"] },
    });

    expect(policy.resolveFor("GESTOR", "u1")).toEqual([
      "tasks.update",
      "tasks.create",
      "timeline.manage",
    ]);
  });

  it("não duplica permissões repetidas", () => {
    const policy = new DashboardPolicy({
      companyDefault: ["tasks.update"],
      rolePermissions: { GESTOR: ["tasks.update"] },
    });

    expect(policy.resolveFor("GESTOR", "u1")).toEqual(["tasks.update"]);
  });

  it("canManageBoard exige kanban.manage para o quadro global", () => {
    const policy = new DashboardPolicy({
      companyDefault: [],
      rolePermissions: { GESTOR: ["kanban.manage"] },
    });

    expect(policy.canManageBoard("GESTOR", "u1", "company")).toBe(true);
    expect(policy.canManageBoard("DESENVOLVEDOR", "u1", "company")).toBe(false);
  });

  it("permite gerenciar o próprio quadro sem kanban.manage quando habilitado", () => {
    const policy = new DashboardPolicy({
      companyDefault: [],
      allowPersonalKanbanManagement: true,
    });

    expect(policy.canManageBoard(null, "u1", "own")).toBe(true);
    expect(policy.canManageBoard(null, "u1", "company")).toBe(false);
  });

  it("não permite gerenciar o próprio quadro quando a opção está desligada", () => {
    const policy = new DashboardPolicy({
      companyDefault: [],
      allowPersonalKanbanManagement: false,
    });

    expect(policy.canManageBoard(null, "u1", "own")).toBe(false);
  });

  it("a política padrão contempla o requisito §11: funcionário gerencia o próprio quadro sem alterar o global", () => {
    expect(DEFAULT_DASHBOARD_POLICY.canManageBoard("DESENVOLVEDOR", "u1", "own")).toBe(true);
    expect(DEFAULT_DASHBOARD_POLICY.canManageBoard("DESENVOLVEDOR", "u1", "company")).toBe(false);
    expect(DEFAULT_DASHBOARD_POLICY.canManageBoard("GESTOR", "u1", "company")).toBe(true);
    expect(DEFAULT_DASHBOARD_POLICY.resolveFor("GESTOR", "u1")).toEqual([...DASHBOARD_PERMISSIONS]);
  });
});
