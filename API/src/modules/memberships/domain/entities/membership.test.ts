import { describe, expect, it } from "vitest";
import { Membership } from "./membership.js";

const base = { companyId: "company-1", userId: "user-1", position: "DESENVOLVEDOR" };

describe("Membership", () => {
  it("cria com cargo, ativa", () => {
    const membership = Membership.create(base);

    expect(membership.companyId).toBe("company-1");
    expect(membership.userId).toBe("user-1");
    expect(membership.position).toBe("DESENVOLVEDOR");
    expect(membership.isActive).toBe(true);
    expect(membership.createdAt).toBeInstanceOf(Date);
  });

  it("restaura a partir de props", () => {
    const now = new Date();
    const membership = Membership.restore({
      id: "m-1",
      ...base,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    });

    expect(membership.id).toBe("m-1");
    expect(membership.isActive).toBe(false);
  });

  it("altera o cargo", () => {
    const membership = Membership.create(base);

    membership.changePosition("GESTOR");

    expect(membership.position).toBe("GESTOR");
  });

  it("rejeita cargo inválido na criação", () => {
    expect(() => Membership.create({ ...base, position: "" })).toThrow("Cargo não pode ser vazio");
  });

  it("desativa e reativa", () => {
    const membership = Membership.create(base);

    membership.deactivate();
    expect(membership.isActive).toBe(false);

    membership.reactivate();
    expect(membership.isActive).toBe(true);
  });

  it("compara identidade pelo id", () => {
    const a = Membership.create(base, "m-1");
    const b = Membership.create(base, "m-1");

    expect(a.equals(b)).toBe(true);
  });
});
