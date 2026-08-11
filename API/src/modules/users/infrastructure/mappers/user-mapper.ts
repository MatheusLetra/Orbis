import { User } from "../../domain/entities/user.js";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toEntity(row: UserRow): User {
  return User.restore(row);
}

export function toInsertValues(user: User): UserRow {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.passwordHash,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
