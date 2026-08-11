import { describe, expect, it, vi } from "vitest";
import { User } from "@/modules/users/domain/entities/user";
import { ConflictError, ValidationError } from "@/shared/errors/typed-errors";
import { fakePasswordHasher, InMemoryUserRepository } from "@/test/fakes/identity-fakes";
import { CreateUser } from "./create-user";

describe("CreateUser", () => {
  it("cria usuário com senha hasheada e não expõe o hash", async () => {
    const userRepository = new InMemoryUserRepository();
    const hash = vi.fn(fakePasswordHasher.hash);
    const useCase = new CreateUser(userRepository, { hash, verify: fakePasswordHasher.verify });

    const output = await useCase.execute({
      email: "Dev@Orbis.com",
      name: "Ana Dev",
      password: "senha-muito-forte",
    });

    expect(output.email).toBe("dev@orbis.com");
    expect(output.name).toBe("Ana Dev");
    expect(output).not.toHaveProperty("passwordHash");
    expect(hash).toHaveBeenCalledWith("senha-muito-forte");
  });

  it("valida e-mail inválido", async () => {
    const useCase = new CreateUser(new InMemoryUserRepository(), fakePasswordHasher);

    await expect(
      useCase.execute({ email: "nao-e-email", name: "Ana", password: "senha-longa" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("valida senha curta", async () => {
    const useCase = new CreateUser(new InMemoryUserRepository(), fakePasswordHasher);

    await expect(
      useCase.execute({ email: "ana@orbis.com", name: "Ana", password: "curta" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("lança ConflictError quando o e-mail já existe", async () => {
    const userRepository = new InMemoryUserRepository();
    const passwordHash = await fakePasswordHasher.hash("senha-qualquer");
    await userRepository.create(
      User.create({ email: "dev@orbis.com", name: "Existente", passwordHash }),
    );

    const useCase = new CreateUser(userRepository, fakePasswordHasher);

    await expect(
      useCase.execute({ email: "dev@orbis.com", name: "Outra", password: "senha-longa" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
