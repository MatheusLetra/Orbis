import { z } from "zod";

const devJwtAccessSecret = "dev-access-secret-com-pelo-menos-32-caracteres-0000";
const devJwtRefreshSecret = "dev-refresh-secret-com-pelo-menos-32-caracteres-000";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url().default("postgres://postgres:postgres@localhost:5432/orbis"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET deve ter ao menos 32 caracteres")
    .default(devJwtAccessSecret),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET deve ter ao menos 32 caracteres")
    .default(devJwtRefreshSecret),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
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
  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    if (
      env.JWT_ACCESS_SECRET === devJwtAccessSecret ||
      env.JWT_REFRESH_SECRET === devJwtRefreshSecret
    ) {
      throw new Error(
        "Configuração de ambiente inválida: JWT_ACCESS_SECRET e JWT_REFRESH_SECRET devem ser definidos em produção",
      );
    }
  }
  return env;
}
