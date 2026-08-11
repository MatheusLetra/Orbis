import type { PasswordHasher } from "../../modules/users/application/ports/password-hasher.js";
import { hashPassword, verifyPassword } from "./password-hasher.js";

export const scryptPasswordHasher: PasswordHasher = {
  hash: hashPassword,
  verify: verifyPassword,
};
