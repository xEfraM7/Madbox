"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Prescription, ScoreType } from "@/lib/constants/wod-score"

export type NumOrEmpty = number | ""

export interface WodScoreInputValues {
  score_type: ScoreType
  minutes: NumOrEmpty
  seconds: NumOrEmpty
  rounds: NumOrEmpty
  reps_extra: NumOrEmpty
  kg: NumOrEmpty
  weights: NumOrEmpty[]
}

interface WodScoreInputsProps {
  values: WodScoreInputValues
  onChange: (next: WodScoreInputValues) => void
  errors?: Partial<Record<keyof WodScoreInputValues | `weight_${number}`, string>>
  prescription?: Prescription
}

function parseNum(v: string): NumOrEmpty {
  if (v === "") return ""
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : ""
}

export function WodScoreInputs({ values, onChange, errors, prescription }: WodScoreInputsProps) {
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
              onChange={(e) => set("minutes", parseNum(e.target.value))}
              placeholder="0"
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
              onChange={(e) => set("seconds", parseNum(e.target.value))}
              placeholder="0"
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
              onChange={(e) => set("rounds", parseNum(e.target.value))}
              placeholder="0"
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
              onChange={(e) => set("reps_extra", parseNum(e.target.value))}
              placeholder="0"
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
            onChange={(e) => set("kg", parseNum(e.target.value))}
            placeholder="Ej: 100"
          />
          {errors?.kg && <p className="text-xs text-destructive">{errors.kg}</p>}
        </div>
      )
    case "sets_reps_rm":
      if (!prescription || prescription.length === 0) {
        return (
          <p className="text-xs italic text-destructive">
            El slot no tiene prescripción definida.
          </p>
        )
      }
      return (
        <div className="space-y-2">
          <Label className="text-sm">Peso por bloque (kg)</Label>
          <div className="space-y-1.5">
            {prescription.map((row, idx) => {
              const errKey = `weight_${idx}` as const
              const err = errors?.[errKey]
              return (
                <div key={idx} className="space-y-1">
                  <div className="grid grid-cols-[1fr_1fr] items-center gap-3">
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {row.sets} × {row.reps}
                      {typeof row.percent === "number" ? ` @ ${row.percent}%` : ""}
                    </span>
                    <Input
                      type="number"
                      step="0.5"
                      min={0.5}
                      max={500}
                      value={values.weights[idx] ?? ""}
                      onChange={(e) => {
                        const next = values.weights.slice()
                        next[idx] = parseNum(e.target.value)
                        set("weights", next)
                      }}
                      placeholder="kg"
                      aria-label={`Peso bloque ${idx + 1}`}
                    />
                  </div>
                  {err && <p className="text-xs text-destructive">{err}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )
  }
}
