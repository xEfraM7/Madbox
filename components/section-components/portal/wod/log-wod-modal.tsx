"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Save, Trash2 } from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  upsertWodLog, deleteWodLog, getMyPlanRoutines,
  type WodLog,
} from "@/lib/actions/wod-logs"
import {
  type ScoreType, SCORE_TYPE_LABEL, SCORE_TYPE_ORDER,
  todayCaracasISO, getDayOfWeekLabel,
} from "@/lib/constants/wod-score"
import { WodScoreInputs, type WodScoreInputValues } from "./WodScoreInputs"

interface LogWodModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingLog?: WodLog | null
  defaultDate?: string
  defaultRoutineId?: string
}

const EMPTY_VALUES: WodScoreInputValues = {
  score_type: "for_time",
  minutes: 0, seconds: 0,
  rounds: 0, reps_extra: 0,
  reps: 0, kg: 0,
}

export function LogWodModal({ open, onOpenChange, existingLog, defaultDate, defaultRoutineId }: LogWodModalProps) {
  const queryClient = useQueryClient()
  const today = todayCaracasISO()

  const [date, setDate] = useState<string>(defaultDate ?? today)
  const [values, setValues] = useState<WodScoreInputValues>(EMPTY_VALUES)
  const [rx, setRx] = useState<boolean>(false)
  const [notes, setNotes] = useState<string>("")
  const [errors, setErrors] = useState<Partial<Record<keyof WodScoreInputValues, string>>>({})

  const { data: planRoutines = [] } = useQuery({
    queryKey: ["my-plan-routines"],
    queryFn: getMyPlanRoutines,
    staleTime: 5 * 60 * 1000,
  })

  const dayLabel = getDayOfWeekLabel(date)
  const routineForDay = useMemo(
    () => planRoutines.find((p) => p.day_of_week === dayLabel)?.routine ?? null,
    [planRoutines, dayLabel],
  )

  useEffect(() => {
    if (!open) return
    if (existingLog) {
      setDate(existingLog.date)
      setRx(existingLog.rx)
      setNotes(existingLog.notes ?? "")
      const t = existingLog.score_type
      setValues({
        score_type: t,
        minutes: t === "for_time" ? Math.floor((existingLog.score_seconds ?? 0) / 60) : 0,
        seconds: t === "for_time" ? (existingLog.score_seconds ?? 0) % 60 : 0,
        rounds: t === "amrap" ? (existingLog.score_rounds ?? 0) : 0,
        reps_extra: t === "amrap" ? (existingLog.score_reps ?? 0) : 0,
        reps: t === "for_reps" ? (existingLog.score_reps ?? 0) : 0,
        kg: t === "weight" ? Number(existingLog.score_kg ?? 0) : 0,
      })
    } else {
      setDate(defaultDate ?? today)
      setRx(false)
      setNotes("")
      setValues(EMPTY_VALUES)
    }
    setErrors({})
  }, [open, existingLog, defaultDate, today])

  const targetRoutineId = existingLog?.routine_id ?? defaultRoutineId ?? routineForDay?.id ?? null

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!targetRoutineId) throw new Error("No hay rutina asignada para esa fecha")

      const errs: Partial<Record<keyof WodScoreInputValues, string>> = {}
      let payload: Parameters<typeof upsertWodLog>[0]
      switch (values.score_type) {
        case "for_time": {
          const total = values.minutes * 60 + values.seconds
          if (total <= 0) errs.seconds = "Ingresa un tiempo válido"
          payload = {
            routine_id: targetRoutineId,
            date,
            score_type: "for_time",
            score_seconds: total,
            rx, notes: notes || null,
          }
          break
        }
        case "amrap": {
          if (values.rounds < 0) errs.rounds = "Inválido"
          if (values.reps_extra < 0) errs.reps_extra = "Inválido"
          payload = {
            routine_id: targetRoutineId,
            date,
            score_type: "amrap",
            score_rounds: values.rounds,
            score_reps: values.reps_extra,
            rx, notes: notes || null,
          }
          break
        }
        case "for_reps": {
          if (values.reps <= 0) errs.reps = "Debe ser > 0"
          payload = {
            routine_id: targetRoutineId,
            date,
            score_type: "for_reps",
            score_reps: values.reps,
            rx, notes: notes || null,
          }
          break
        }
        case "weight": {
          if (values.kg <= 0 || values.kg > 500) errs.kg = "Fuera de rango (0–500 kg)"
          payload = {
            routine_id: targetRoutineId,
            date,
            score_type: "weight",
            score_kg: values.kg,
            rx, notes: notes || null,
          }
          break
        }
      }
      if (Object.keys(errs).length > 0) {
        setErrors(errs)
        throw new Error("Corrige los errores")
      }
      setErrors({})
      return upsertWodLog(payload!)
    },
    onSuccess: () => {
      toast.success(existingLog ? "WOD actualizado" : "WOD registrado")
      queryClient.invalidateQueries({ queryKey: ["today-wod-log"] })
      queryClient.invalidateQueries({ queryKey: ["my-wod-history"] })
      queryClient.invalidateQueries({ queryKey: ["today-leaderboard"] })
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al guardar")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!existingLog) return
      return deleteWodLog(existingLog.id)
    },
    onSuccess: () => {
      toast.success("WOD borrado")
      queryClient.invalidateQueries({ queryKey: ["today-wod-log"] })
      queryClient.invalidateQueries({ queryKey: ["my-wod-history"] })
      queryClient.invalidateQueries({ queryKey: ["today-leaderboard"] })
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al borrar")
    },
  })

  const setScoreType = (t: ScoreType) => setValues({ ...values, score_type: t })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingLog ? "Editar WOD" : "Registrar WOD"}</DialogTitle>
          <DialogDescription>
            {routineForDay
              ? <>Rutina: <span className="font-semibold">{routineForDay.name}</span></>
              : <span className="text-destructive">Sin rutina asignada para {dayLabel}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="date" className="text-sm">Fecha</Label>
            <Input
              id="date"
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="scheme-dark"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Tipo de score</Label>
            <div className="grid grid-cols-4 gap-1 rounded-md border border-border p-1">
              {SCORE_TYPE_ORDER.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setScoreType(t)}
                  className={cn(
                    "px-2 py-1.5 text-xs font-medium rounded transition-colors",
                    values.score_type === t
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  {SCORE_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <WodScoreInputs values={values} onChange={setValues} errors={errors} />

          <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <div>
              <Label htmlFor="rx" className="text-sm font-medium">Como Rx</Label>
              <p className="text-xs text-muted-foreground">¿Hiciste el WOD como prescrito?</p>
            </div>
            <Switch id="rx" checked={rx} onCheckedChange={setRx} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-sm">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Ej: usé KB 16kg, partner Juan"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              rows={3}
            />
            <p className="text-[11px] text-muted-foreground">{notes.length} / 500</p>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row mt-2">
          {existingLog && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending || upsertMutation.isPending}
              className="gap-2 text-destructive hover:text-destructive sm:mr-auto"
            >
              {deleteMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Trash2 className="h-4 w-4" />
              }
              Borrar
            </Button>
          )}
          <Button
            type="button"
            onClick={() => upsertMutation.mutate()}
            disabled={upsertMutation.isPending || deleteMutation.isPending || !targetRoutineId}
            className="gap-2"
          >
            {upsertMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Save className="h-4 w-4" />
            }
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
