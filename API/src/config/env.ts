import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url().default("postgres://postgres:postgres@localhost:5432/orbis"),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    throw new Error(
      `Configuração de ambiente inválida: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}
