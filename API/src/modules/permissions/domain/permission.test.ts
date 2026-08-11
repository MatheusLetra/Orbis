import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  isPermission,
  PERMISSIONS,
  toPermissions,
} from "@/modules/permissions/domain/permission";
import {
  isRole,
  permissionsForPosition,
  permissionsForRole,
  ROLE_PERMISSIONS,
  ROLES,
} from "@/modules/permissions/domain/role";

describe("Permission", () => {
  it("define a lista inicial de permissões do AGENTS §10", () => {
    expect(PERMISSIONS).toEqual([
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
    ]);
  });

  it("guarda as permissões conhecidas", () => {
    expect(isPermission("company.read")).toBe(true);
    expect(isPermission("tasks.delete")).toBe(true);
  });

  it("rejeita valores desconhecidos", () => {
    expect(isPermission("company.banana")).toBe(false);
    expect(isPermission("")).toBe(false);
  });

  it("filtra apenas permissões válidas de uma lista", () => {
    expect(toPermissions(["company.read", "invented.perm", "tasks.create"])).toEqual([
      "company.read",
      "tasks.create",
    ]);
    expect(toPermissions(["nada"])).toEqual([]);
  });

  it("ALL_PERMISSIONS referencia a mesma lista inicial", () => {
    expect(ALL_PERMISSIONS).toHaveLength(PERMISSIONS.length);
  });
});

describe("Role presets", () => {
  it("define os cargos iniciais do AGENTS §11.1", () => {
    expect(ROLES).toEqual(["ADMINISTRADOR", "GESTOR", "SUPORTE", "TESTADOR", "DESENVOLVEDOR"]);
  });

  it("guarda cargos conhecidos", () => {
    expect(isRole("GESTOR")).toBe(true);
    expect(isRole("Desenvolvedor")).toBe(false);
  });

  it("ADMINISTRADOR possui todas as permissões", () => {
    expect(ROLE_PERMISSIONS.ADMINISTRADOR).toEqual([...ALL_PERMISSIONS]);
  });

  it("GESTOR possui permissões de gestão e leitura completas", () => {
    const permissions = permissionsForRole("GESTOR");
    expect(permissions).toContain("company.read");
    expect(permissions).toContain("company.update");
    expect(permissions).toContain("users.manage");
    expect(permissions).toContain("permissions.manage");
    expect(permissions).toContain("requisitions.create");
    expect(permissions).toContain("kanban.manage");
    expect(permissions).toContain("audit.read");
  });

  it("SUPORTE não possui permissões de escrita de negócio", () => {
    const permissions = permissionsForRole("SUPORTE");
    expect(permissions).toContain("company.read");
    expect(permissions).toContain("chat.use");
    expect(permissions).not.toContain("company.update");
    expect(permissions).not.toContain("requisitions.create");
    expect(permissions).not.toContain("kanban.manage");
  });

  it("permissionsForPosition resolve preset por cargo e retorna vazio para cargos livres", () => {
    expect(permissionsForPosition("DESENVOLVEDOR")).toEqual(permissionsForRole("DESENVOLVEDOR"));
    expect(permissionsForPosition("Analista")).toEqual([]);
  });

  it("presets são cópias (mutar o resultado não altera o mapa)", () => {
    const copy = permissionsForRole("GESTOR");
    copy.push("company.update");
    expect(permissionsForRole("GESTOR")).toHaveLength(copy.length - 1);
  });
});
