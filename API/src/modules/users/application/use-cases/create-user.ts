import {
  type CreateUserInput,
  createUserSchema,
  toUserOutput,
  type UserOutput,
} from "@/modules/users/application/dto/user-dtos";
import type { PasswordHasher } from "@/modules/users/application/ports/password-hasher";
import { User } from "@/modules/users/domain/entities/user";
import type { UserRepository } from "@/modules/users/domain/repositories/user-repository";
import type { UseCase } from "@/shared/application/use-case";
import { ConflictError, ValidationError } from "@/shared/errors/typed-errors";

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
