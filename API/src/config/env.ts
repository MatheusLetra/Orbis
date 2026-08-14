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
  JWT_ISSUER: z.string().min(1).default("orbis-api"),
  JWT_AUDIENCE: z.string().min(1).default("orbis"),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  const provided = { ...process.env, ...overrides };
  const parsed = envSchema.safeParse(provided);
  if (!parsed.success) {
    throw new Error(
      `Configuração de ambiente inválida: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    if (!provided.DATABASE_URL) {
      throw new Error(
        "Configuração de ambiente inválida: DATABASE_URL deve ser definida em produção",
      );
    }
    if (!env.FRONTEND_ORIGIN.startsWith("https://")) {
      throw new Error(
        "Configuração de ambiente inválida: FRONTEND_ORIGIN deve usar HTTPS em produção",
      );
    }
    const secretPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{32,}$/;
    if (
      env.JWT_ACCESS_SECRET === devJwtAccessSecret ||
      env.JWT_REFRESH_SECRET === devJwtRefreshSecret ||
      !secretPattern.test(env.JWT_ACCESS_SECRET) ||
      !secretPattern.test(env.JWT_REFRESH_SECRET)
    ) {
      throw new Error(
        "Configuração de ambiente inválida: JWT_ACCESS_SECRET e JWT_REFRESH_SECRET devem ser definidos em produção",
      );
    }
  }
  return env;
}
