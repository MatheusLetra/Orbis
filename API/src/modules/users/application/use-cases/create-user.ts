import type { UseCase } from "../../../../shared/application/use-case.js";
import { ConflictError, ValidationError } from "../../../../shared/errors/typed-errors.js";
import { User } from "../../domain/entities/user.js";
import type { UserRepository } from "../../domain/repositories/user-repository.js";
import {
  type CreateUserInput,
  createUserSchema,
  toUserOutput,
  type UserOutput,
} from "../dto/user-dtos.js";
import type { PasswordHasher } from "../ports/password-hasher.js";

export class CreateUser implements UseCase<CreateUserInput, UserOutput> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: CreateUserInput): Promise<UserOutput> {
    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados de usuário inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    const existing = await this.userRepository.findByEmail(parsed.data.email);
    if (existing) {
      throw new ConflictError("Já existe um usuário com este e-mail");
    }

    const passwordHash = await this.passwordHasher.hash(parsed.data.password);
    const user = User.create({
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
    });

    const created = await this.userRepository.create(user);

    return toUserOutput(created);
  }
}
