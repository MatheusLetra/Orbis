import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(320),
  password: z.string().min(1, "Senha é obrigatória").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

export interface LoginOutput {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token é obrigatório"),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export interface RefreshTokenOutput {
  accessToken: string;
  refreshToken: string;
}

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token é obrigatório"),
});

export type LogoutInput = z.infer<typeof logoutSchema>;
