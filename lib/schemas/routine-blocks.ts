import { z } from "zod"

const baseBlock = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
})

const movementsArray = z
  .array(z.string().min(1, "Cada movimiento debe tener texto"))
  .min(1, "Debe haber al menos un movimiento")

export const warmupBlockSchema = baseBlock.extend({
  type: z.literal("warmup"),
  text: z.string(),
})

export const cooldownBlockSchema = baseBlock.extend({
  type: z.literal("cooldown"),
  text: z.string(),
})

export const notesBlockSchema = baseBlock.extend({
  type: z.literal("notes"),
  text: z.string(),
})

export const strengthBlockSchema = baseBlock.extend({
  type: z.literal("strength"),
  exercise: z.string().min(1, "Ejercicio requerido"),
  sets: z.number().int().min(1).max(20),
  reps: z.string().min(1, "Reps requeridas"),
  weight: z.string().optional(),
  notes: z.string().optional(),
})

export const skillBlockSchema = baseBlock.extend({
  type: z.literal("skill"),
  exercises: z.array(z.string().min(1)).min(1, "Al menos un ejercicio"),
  notes: z.string().optional(),
})

export const amrapBlockSchema = baseBlock.extend({
  type: z.literal("amrap"),
  minutes: z.number().int().min(1).max(120),
  movements: movementsArray,
})

export const emomBlockSchema = baseBlock.extend({
  type: z.literal("emom"),
  minutes: z.number().int().min(1).max(120),
  movements: movementsArray,
  alternating: z.boolean(),
})

export const forTimeBlockSchema = baseBlock.extend({
  type: z.literal("for_time"),
  movements: movementsArray,
  time_cap_min: z.number().int().min(1).max(120).optional(),
})

export const forRepsBlockSchema = baseBlock.extend({
  type: z.literal("for_reps"),
  target_reps: z.number().int().min(1).max(99999),
  movements: movementsArray,
})

export const rftBlockSchema = baseBlock.extend({
  type: z.literal("rft"),
  rounds: z.number().int().min(1).max(50),
  movements: movementsArray,
})

export const routineBlockSchema = z.discriminatedUnion("type", [
  warmupBlockSchema,
  cooldownBlockSchema,
  notesBlockSchema,
  strengthBlockSchema,
  skillBlockSchema,
  amrapBlockSchema,
  emomBlockSchema,
  forTimeBlockSchema,
  forRepsBlockSchema,
  rftBlockSchema,
])

export const routineBlocksSchema = z
  .array(routineBlockSchema)
  .min(1, "La rutina debe tener al menos un bloque")
