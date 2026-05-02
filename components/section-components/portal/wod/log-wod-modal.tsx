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
import {
  upsertWodLog, deleteWodLog, getMyPlanRoutines,
  type WodLog,
} from "@/lib/actions/wod-logs"
import {
  type ScoreType,
  todayCaracasISO, getDayOfWeekLabel,
} from "@/lib/constants/wod-score"
import {
  parseBlocks,
  getPrimaryConditioningBlock,
  getScoreTypeForBlock,
  BLOCK_META,
  type RoutineBlock,
} from "@/lib/constants/routine-blocks"
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

function blockHeadline(block: RoutineBlock): string {
  switch (block.type) {
    case "amrap":    return `${BLOCK_META.amrap.label} ${block.minutes} min`
    case "for_time": return BLOCK_META.for_time.label + (block.time_cap_min ? ` · cap ${block.time_cap_min} min` : "")
    case "rft":      return `${BLOCK_META.rft.label} · ${block.rounds} rounds`
    case "for_reps": return `${BLOCK_META.for_reps.label} · ${block.target_reps} reps`
    case "strength": return `${BLOCK_META.strength.label}: ${block.exercise || "(sin ejercicio)"}`
    default:         return BLOCK_META[block.type].label
  }
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

  const primaryBlock = useMemo<RoutineBlock | null>(() => {
    if (!routineForDay) return null
    return getPrimaryConditioningBlock(parseBlocks(routineForDay.blocks))
  }, [routineForDay])

  const scoreType: ScoreType | null = getScoreTypeForBlock(primaryBlock)

  // Reset al abrir
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

  // Cuando cambia el scoreType derivado, actualiza el state local
  useEffect(() => {
    if (!open || existingLog) return
    if (scoreType) {
      setValues((prev) => ({ ...prev, score_type: scoreType }))
    }
  }, [open, existingLog, scoreType])

  const targetRoutineId = existingLog?.routine_id ?? defaultRoutineId ?? routineForDay?.id ?? null
  const effectiveScoreType: ScoreType | null = existingLog?.score_type ?? scoreType ?? null

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!targetRoutineId) throw new Error("No hay rutina asignada para esa fecha")
      if (!effectiveScoreType) throw new Error("Esta rutina no tiene un bloque registrable")

      const errs: Partial<Record<keyof WodScoreInputValues, string>> = {}
      let payload: Parameters<typeof upsertWodLog>[0]
      switch (effectiveScoreType) {
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

  // Sync values.score_type con effectiveScoreType para que WodScoreInputs muestre los inputs correctos
  const inputValues = effectiveScoreType ? { ...values, score_type: effectiveScoreType } : values

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingLog ? "Editar WOD" : "Registrar WOD"}</DialogTitle>
          <DialogDescription>
            {primaryBlock
              ? <>Score: <span className="font-semibold">{blockHeadline(primaryBlock)}</span></>
              : <span className="text-destructive">No hay bloque registrable en esta rutina</span>}
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

          {effectiveScoreType ? (
            <WodScoreInputs values={inputValues} onChange={(v) => setValues(v)} errors={errors} />
          ) : (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              Sin score asociado para esta rutina.
            </p>
          )}

          {effectiveScoreType && (
            <>
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
            </>
          )}
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
            disabled={upsertMutation.isPending || deleteMutation.isPending || !targetRoutineId || !effectiveScoreType}
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
