"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Save, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  upsertWodLog,
  deleteWodLog,
  type WodLog,
} from "@/lib/actions/wod-logs"
import { SCORE_TYPE_LABEL } from "@/lib/constants/wod-score"
import type { ScoreSlot } from "@/lib/constants/score-slots"
import { WodScoreInputs, type WodScoreInputValues } from "./WodScoreInputs"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  routineId: string
  slot: ScoreSlot
  existingLog: WodLog | null
}

const EMPTY_VALUES: WodScoreInputValues = {
  score_type: "for_time",
  minutes: 0, seconds: 0,
  rounds: 0, reps_extra: 0,
  reps: 0, kg: 0,
}

export function LogWodModal({ open, onOpenChange, routineId, slot, existingLog }: Props) {
  const queryClient = useQueryClient()
  const scoreType = slot.score_type

  const [values, setValues] = useState<WodScoreInputValues>(EMPTY_VALUES)
  const [rx, setRx] = useState<boolean>(false)
  const [notes, setNotes] = useState<string>("")
  const [errors, setErrors] = useState<Partial<Record<keyof WodScoreInputValues, string>>>({})

  useEffect(() => {
    if (!open) return
    if (existingLog) {
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
      setRx(false)
      setNotes("")
      setValues({ ...EMPTY_VALUES, score_type: scoreType })
    }
    setErrors({})
  }, [open, existingLog, scoreType])

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const errs: Partial<Record<keyof WodScoreInputValues, string>> = {}
      let payload: Parameters<typeof upsertWodLog>[0]
      switch (scoreType) {
        case "for_time": {
          const total = values.minutes * 60 + values.seconds
          if (total <= 0) errs.seconds = "Ingresa un tiempo válido"
          payload = {
            routine_id: routineId,
            slot_id: slot.id,
            score_type: "for_time",
            score_seconds: total,
            rx,
            notes: notes || null,
          }
          break
        }
        case "amrap": {
          if (values.rounds < 0) errs.rounds = "Inválido"
          if (values.reps_extra < 0) errs.reps_extra = "Inválido"
          if (values.rounds + values.reps_extra === 0) errs.rounds = "Score vacío"
          payload = {
            routine_id: routineId,
            slot_id: slot.id,
            score_type: "amrap",
            score_rounds: values.rounds,
            score_reps: values.reps_extra,
            rx,
            notes: notes || null,
          }
          break
        }
        case "for_reps": {
          if (values.reps <= 0) errs.reps = "Debe ser > 0"
          payload = {
            routine_id: routineId,
            slot_id: slot.id,
            score_type: "for_reps",
            score_reps: values.reps,
            rx,
            notes: notes || null,
          }
          break
        }
        case "weight": {
          if (values.kg <= 0 || values.kg > 500) errs.kg = "Fuera de rango (0–500 kg)"
          payload = {
            routine_id: routineId,
            slot_id: slot.id,
            score_type: "weight",
            score_kg: values.kg,
            rx,
            notes: notes || null,
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
      queryClient.invalidateQueries({ queryKey: ["my-wod-logs"] })
      queryClient.invalidateQueries({ queryKey: ["wod-leaderboard"] })
      queryClient.invalidateQueries({ queryKey: ["routine-today"] })
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
      queryClient.invalidateQueries({ queryKey: ["my-wod-logs"] })
      queryClient.invalidateQueries({ queryKey: ["wod-leaderboard"] })
      queryClient.invalidateQueries({ queryKey: ["routine-today"] })
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al borrar")
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingLog ? "Editar WOD" : "Registrar WOD"}</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{slot.name}</span>
            <span className="ml-1.5 text-xs text-muted-foreground">
              · score: {SCORE_TYPE_LABEL[scoreType]}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <WodScoreInputs values={values} onChange={(v) => setValues(v)} errors={errors} />

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
            disabled={upsertMutation.isPending || deleteMutation.isPending}
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
