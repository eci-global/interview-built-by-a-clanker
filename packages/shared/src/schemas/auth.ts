import { z } from "zod";

const emailField = z.string().trim().toLowerCase().email("Enter a valid email address");

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username may only contain letters, numbers, '.', '_' and '-'"),
  email: emailField,
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password must be at most 128 characters"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required").max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().email(),
});

export type User = z.infer<typeof userSchema>;

export interface AuthResponse {
  token: string;
  user: User;
}
