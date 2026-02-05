import { z } from "zod";

export const AnalysisResponseSchema = z.object({
  food_name: z.string(),
  estimated_kcal: z.number(),
  macros_g: z.object({
    carbs: z.number(),
    protein: z.number(),
    fat: z.number(),
  }),
  confidence: z.enum(["low", "medium", "high"]),
  reason: z.string(),
  notes: z.array(z.string()),
});

export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;
