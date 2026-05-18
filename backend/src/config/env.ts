import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  INSALES_SHOP_URL: z.url(),
  INSALES_ACCESS_TOKEN: z.string().min(1),
  INSALES_API_KEY: z.string().optional(),
  INSALES_API_PASSWORD: z.string().optional()
});

export const env = envSchema.parse(process.env);
