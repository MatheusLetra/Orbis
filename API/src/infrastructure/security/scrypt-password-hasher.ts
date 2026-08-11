import type { PasswordHasher } from "@/modules/users/application/ports/password-hasher";
import { hashPassword, verifyPassword } from "./password-hasher";

export const scryptPasswordHasher: PasswordHasher = {
  hash: hashPassword,
  verify: verifyPassword,
};
