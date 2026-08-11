import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PREFIX = "scrypt";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `${PREFIX}:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [prefix, salt, hash] = storedHash.split(":");

  if (prefix !== PREFIX || !salt || !hash) {
    return false;
  }

  const derived = await scrypt(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
