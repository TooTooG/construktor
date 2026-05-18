import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  INSALES_SHOP_URL: z.url(),
  INSALES_ACCESS_TOKEN: z.string().min(1).optional(),
  INSALES_API_KEY: z.string().min(1).optional(),
  INSALES_API_PASSWORD: z.string().min(1).optional()
}).superRefine((value, ctx) => {
  const hasBasicAuth = Boolean(value.INSALES_API_KEY && value.INSALES_API_PASSWORD);
  const hasBearerAuth = Boolean(value.INSALES_ACCESS_TOKEN);

  if (!hasBasicAuth && !hasBearerAuth) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Укажите INSALES_API_KEY + INSALES_API_PASSWORD или INSALES_ACCESS_TOKEN."
    });
  }

  if (value.INSALES_API_KEY && !value.INSALES_API_PASSWORD) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Если указан INSALES_API_KEY, нужно указать и INSALES_API_PASSWORD."
    });
  }

  if (value.INSALES_API_PASSWORD && !value.INSALES_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Если указан INSALES_API_PASSWORD, нужно указать и INSALES_API_KEY."
    });
  }
});

export const env = envSchema.parse(process.env);
