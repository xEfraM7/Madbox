import { z } from "zod"

export const prescriptionRowSchema = z.object({
  sets: z.number().int().min(1, "Mínimo 1 set").max(20, "Máximo 20 sets"),
  reps: z.number().int().min(1, "Mínimo 1 rep").max(99, "Máximo 99 reps"),
  percent: z.number().int().min(1).max(200).optional(),
})

export const prescriptionSchema = z
  .array(prescriptionRowSchema)
  .min(1, "Agrega al menos una serie")

export const scoreSlotSchema = z
  .object({
    id: z.string().min(1),
    order: z.number().int().min(0),
    name: z.string().min(1, "Nombre requerido").max(100, "Máx. 100 caracteres"),
    score_type: z.enum(["for_time", "amrap", "weight", "sets_reps_rm"]),
    prescription: z.array(prescriptionRowSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.score_type === "sets_reps_rm") {
      if (!data.prescription || data.prescription.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["prescription"],
          message: "La prescripción es requerida (al menos una serie)",
        })
      }
    }
  })

// Array vacío es válido — rutina sin logging (rest day, recovery, skill puro).
export const scoreSlotsSchema = z.array(scoreSlotSchema)
