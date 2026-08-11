import { describe, expect, it } from "vitest";
import { User } from "./user.js";

const base = {
  email: "dev@orbis.com",
  name: "Ana Dev",
  passwordHash: "scrypt:abc",
};

describe("User", () => {
  it("cria com dados fornecidos", () => {
    const user = User.create(base);

    expect(user.email).toBe("dev@orbis.com");
    expect(user.name).toBe("Ana Dev");
    expect(user.passwordHash).toBe("scrypt:abc");
    expect(user.isActive).toBe(true);
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it("restaura a partir de props", () => {
    const now = new Date();
    const user = User.restore({
      id: "user-1",
      ...base,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    });

    expect(user.id).toBe("user-1");
    expect(user.isActive).toBe(false);
  });

  it("renomeia, altera e-mail e senha", () => {
    const user = User.create(base);

    user.rename("Ana Souza");
    user.changeEmail("ana@orbis.com");
    user.updatePasswordHash("scrypt:xyz");

    expect(user.name).toBe("Ana Souza");
    expect(user.email).toBe("ana@orbis.com");
    expect(user.passwordHash).toBe("scrypt:xyz");
  });

  it("desativa", () => {
    const user = User.create(base);

    user.deactivate();

    expect(user.isActive).toBe(false);
  });

  it("compara identidade pelo id", () => {
    const a = User.create(base, "id-1");
    const b = User.create(base, "id-1");

    expect(a.equals(b)).toBe(true);
  });
});
