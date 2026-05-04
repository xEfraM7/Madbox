export type Gender = "male" | "female"
export type AthleteLevel = "rx" | "scaled" | "beginner"

export const GENDER_LABEL: Record<Gender, string> = {
  male: "Hombre",
  female: "Mujer",
}

export const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: "male", label: "Hombre" },
  { value: "female", label: "Mujer" },
]

export const ATHLETE_LEVEL_LABEL: Record<AthleteLevel, string> = {
  rx: "Rx",
  scaled: "Scaled",
  beginner: "Principiante",
}

export const ATHLETE_LEVEL_OPTIONS: Array<{ value: AthleteLevel; label: string }> = [
  { value: "rx", label: "Rx" },
  { value: "scaled", label: "Scaled" },
  { value: "beginner", label: "Principiante" },
]

export function isGender(v: unknown): v is Gender {
  return v === "male" || v === "female"
}

export function isAthleteLevel(v: unknown): v is AthleteLevel {
  return v === "rx" || v === "scaled" || v === "beginner"
}
