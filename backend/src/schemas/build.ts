import { z } from "zod";

export const buildRequestSchema = z.object({
  templateProductId: z.coerce.number().int().positive(),
  frontProductId: z.coerce.number().int().positive(),
  backProductId: z.coerce.number().int().positive().nullable().optional().transform((value) => value ?? null),
  quantity: z.coerce.number().int().positive().default(1),
  selection: z.record(z.string(), z.string()).refine(
    (value) => Object.keys(value).length > 0,
    "selection cannot be empty"
  )
});

export const buildStatusResponseSchema = z.object({
  buildId: z.string(),
  status: z.enum(["pending", "building", "ready", "failed"]),
  generatedProductId: z.number().int().positive().nullable().optional(),
  generatedVariantId: z.number().int().positive().nullable().optional(),
  productHandle: z.string().nullable().optional(),
  errorText: z.string().nullable().optional()
});
