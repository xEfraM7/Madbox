"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ScoreType } from "@/lib/constants/wod-score"

export interface WodScoreInputValues {
  score_type: ScoreType
  minutes: number
  seconds: number
  rounds: number
  reps_extra: number
  kg: number
}

interface WodScoreInputsProps {
  values: WodScoreInputValues
  onChange: (next: WodScoreInputValues) => void
  errors?: Partial<Record<keyof WodScoreInputValues, string>>
}

function num(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function WodScoreInputs({ values, onChange, errors }: WodScoreInputsProps) {
  const set = <K extends keyof WodScoreInputValues>(k: K, v: WodScoreInputValues[K]) =>
    onChange({ ...values, [k]: v })

  switch (values.score_type) {
    case "for_time":
      return (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="minutes" className="text-sm">Minutos</Label>
            <Input
              id="minutes"
              type="number"
              min={0}
              max={120}
              value={values.minutes}
              onChange={(e) => set("minutes", num(e.target.value))}
            />
            {errors?.minutes && <p className="text-xs text-destructive">{errors.minutes}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seconds" className="text-sm">Segundos</Label>
            <Input
              id="seconds"
              type="number"
              min={0}
              max={59}
              value={values.seconds}
              onChange={(e) => set("seconds", num(e.target.value))}
            />
            {errors?.seconds && <p className="text-xs text-destructive">{errors.seconds}</p>}
          </div>
        </div>
      )
    case "amrap":
      return (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rounds" className="text-sm">Rounds completos</Label>
            <Input
              id="rounds"
              type="number"
              min={0}
              max={999}
              value={values.rounds}
              onChange={(e) => set("rounds", num(e.target.value))}
            />
            {errors?.rounds && <p className="text-xs text-destructive">{errors.rounds}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reps_extra" className="text-sm">Reps extra</Label>
            <Input
              id="reps_extra"
              type="number"
              min={0}
              max={999}
              value={values.reps_extra}
              onChange={(e) => set("reps_extra", num(e.target.value))}
            />
            {errors?.reps_extra && <p className="text-xs text-destructive">{errors.reps_extra}</p>}
          </div>
        </div>
      )
    case "weight":
      return (
        <div className="space-y-1.5">
          <Label htmlFor="kg" className="text-sm">Peso (kg)</Label>
          <Input
            id="kg"
            type="number"
            step="0.5"
            min={0.5}
            max={500}
            value={values.kg}
            onChange={(e) => set("kg", num(e.target.value))}
            placeholder="Ej: 100"
          />
          {errors?.kg && <p className="text-xs text-destructive">{errors.kg}</p>}
        </div>
      )
  }
}
