"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { updateMyProfile } from "@/lib/actions/portal"
import { ATHLETE_LEVEL_OPTIONS, GENDER_OPTIONS } from "@/lib/constants/athlete"

const schema = z.object({
  gender: z.enum(["male", "female"]).nullable(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").or(z.literal("")),
  weight_kg: z.coerce.number().min(30).max(250).or(z.literal("")).optional(),
  height_cm: z.coerce.number().int().min(100).max(220).or(z.literal("")).optional(),
  athlete_since_month: z.string().regex(/^\d{4}-\d{2}$/, "Mes inválido").or(z.literal("")),
  athlete_level: z.enum(["rx", "scaled", "beginner"]).nullable(),
  quote: z.string().max(120).default(""),
})

type FormData = z.infer<typeof schema>

interface Props {
  initial: {
    gender: string | null
    birth_date: string | null
    weight_kg: number | null
    height_cm: number | null
    athlete_since: string | null
    athlete_level: string | null
    quote: string | null
  }
}

export function AthleteProfileForm({ initial }: Props) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: {
      gender: (initial.gender as "male" | "female" | null) ?? null,
      birth_date: initial.birth_date ?? "",
      weight_kg: (initial.weight_kg ?? "") as FormData["weight_kg"],
      height_cm: (initial.height_cm ?? "") as FormData["height_cm"],
      athlete_since_month: initial.athlete_since
        ? initial.athlete_since.slice(0, 7)
        : "",
      athlete_level: (initial.athlete_level as FormData["athlete_level"]) ?? null,
      quote: initial.quote ?? "",
    },
  })

  const gender = watch("gender")
  const level = watch("athlete_level")

  const mutation = useMutation({
    mutationFn: async (d: FormData) => {
      await updateMyProfile({
        gender: d.gender,
        birth_date: d.birth_date === "" ? null : d.birth_date,
        weight_kg: d.weight_kg === "" || d.weight_kg === undefined ? null : Number(d.weight_kg),
        height_cm: d.height_cm === "" || d.height_cm === undefined ? null : Number(d.height_cm),
        athlete_since: d.athlete_since_month === "" ? null : `${d.athlete_since_month}-01`,
        athlete_level: d.athlete_level,
        quote: d.quote.trim() === "" ? null : d.quote.trim(),
      })
    },
    onSuccess: () => {
      toast.success("Perfil de atleta actualizado")
      queryClient.invalidateQueries({ queryKey: ["my-profile"] })
      queryClient.invalidateQueries({ queryKey: ["discoverable-members"] })
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Error al actualizar"),
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base">Perfil de atleta</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((d) => mutation.mutate(d))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm">Género *</Label>
            <RadioGroup
              value={gender ?? ""}
              onValueChange={(v) => setValue("gender", v as "male" | "female", { shouldDirty: true })}
              className="flex gap-4"
            >
              {GENDER_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <RadioGroupItem value={opt.value} id={`gender-${opt.value}`} />
                  <Label htmlFor={`gender-${opt.value}`} className="text-sm font-normal">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <p className="text-[11px] text-muted-foreground">
              Necesario para aparecer en Descubrir.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="birth_date" className="text-xs sm:text-sm">
                Fecha de nacimiento
              </Label>
              <Input id="birth_date" type="date" {...register("birth_date")} />
              {errors.birth_date && (
                <p className="text-xs text-destructive">{errors.birth_date.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="athlete_since_month" className="text-xs sm:text-sm">
                Atleta desde
              </Label>
              <Input
                id="athlete_since_month"
                type="month"
                {...register("athlete_since_month")}
              />
              {errors.athlete_since_month && (
                <p className="text-xs text-destructive">{errors.athlete_since_month.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="weight_kg" className="text-xs sm:text-sm">Peso (kg)</Label>
              <Input
                id="weight_kg"
                type="number"
                step="0.1"
                min="30"
                max="250"
                {...register("weight_kg")}
              />
              {errors.weight_kg && (
                <p className="text-xs text-destructive">{errors.weight_kg.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="height_cm" className="text-xs sm:text-sm">Altura (cm)</Label>
              <Input
                id="height_cm"
                type="number"
                min="100"
                max="220"
                {...register("height_cm")}
              />
              {errors.height_cm && (
                <p className="text-xs text-destructive">{errors.height_cm.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm">Nivel</Label>
            <Select
              value={level ?? ""}
              onValueChange={(v) =>
                setValue("athlete_level", v as "rx" | "scaled" | "beginner", { shouldDirty: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona tu nivel" />
              </SelectTrigger>
              <SelectContent>
                {ATHLETE_LEVEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quote" className="text-xs sm:text-sm">
              Frase / lema (opcional)
            </Label>
            <Textarea
              id="quote"
              rows={2}
              maxLength={120}
              placeholder="Ej: Stronger every day."
              {...register("quote")}
            />
            <p className="text-[11px] text-muted-foreground">Máx 120 caracteres.</p>
          </div>

          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Guardar cambios
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
