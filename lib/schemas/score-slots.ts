import { z } from "zod"

export const scoreSlotSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
  name: z.string().min(1, "Nombre requerido").max(100, "Máx. 100 caracteres"),
  score_type: z.enum(["for_time", "amrap", "weight"]),
})

// Array vacío es válido — rutina sin logging (rest day, recovery, skill puro).
export const scoreSlotsSchema = z.array(scoreSlotSchema)
