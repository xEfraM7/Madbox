"use client"

import { useMemo } from "react"
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createScoreSlot,
  type ScoreSlot,
} from "@/lib/constants/score-slots"
import {
  type Prescription,
  type PrescriptionRow,
  SCORE_TYPE_LABEL,
  SCORE_TYPE_ORDER,
  type ScoreType,
} from "@/lib/constants/wod-score"

interface Props {
  slots: ScoreSlot[]
  onChange: (next: ScoreSlot[]) => void
}

function reorder(slots: ScoreSlot[]): ScoreSlot[] {
  return slots.map((s, i) => ({ ...s, order: i }))
}

function PrescriptionEditor({
  prescription,
  onChange,
}: {
  prescription: Prescription
  onChange: (next: Prescription) => void
}) {
  const setRow = (idx: number, patch: Partial<PrescriptionRow>) => {
    const next = prescription.slice()
    next[idx] = { ...next[idx], ...patch }
    onChange(next)
  }
  const removeRow = (idx: number) => {
    onChange(prescription.filter((_, i) => i !== idx))
  }
  const addRow = () => {
    onChange([...prescription, { sets: 1, reps: 5 }])
  }

  return (
    <div className="space-y-1.5 rounded-md border border-dashed border-border bg-background/40 p-2">
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-1.5 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>Sets</span>
        <span>Reps</span>
        <span>%RM</span>
        <span className="w-7" />
      </div>
      {prescription.length === 0 && (
        <p className="px-1 py-2 text-xs italic text-destructive">
          Agrega al menos una serie
        </p>
      )}
      {prescription.map((row, idx) => (
        <div
          key={idx}
          className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-1.5"
        >
          <Input
            type="number"
            min={1}
            max={20}
            value={row.sets === 0 ? "" : row.sets}
            onChange={(e) => {
              const v = e.target.value
              setRow(idx, { sets: v === "" ? 0 : Number(v) })
            }}
            placeholder="0"
            className="h-8"
          />
          <Input
            type="number"
            min={1}
            max={99}
            value={row.reps === 0 ? "" : row.reps}
            onChange={(e) => {
              const v = e.target.value
              setRow(idx, { reps: v === "" ? 0 : Number(v) })
            }}
            placeholder="0"
            className="h-8"
          />
          <Input
            type="number"
            min={1}
            max={200}
            placeholder="opt."
            value={row.percent ?? ""}
            onChange={(e) => {
              const v = e.target.value
              setRow(idx, { percent: v === "" ? undefined : Number(v) })
            }}
            className="h-8"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-destructive"
            onClick={() => removeRow(idx)}
            disabled={prescription.length <= 1}
            aria-label="Eliminar serie"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={addRow}
        className="w-full gap-1 text-xs"
      >
        <Plus className="h-3 w-3" /> Agregar serie
      </Button>
    </div>
  )
}

export function ScoreSlotsManager({ slots, onChange }: Props) {
  const sorted = useMemo(
    () => [...slots].sort((a, b) => a.order - b.order),
    [slots],
  )

  const addSlot = () => {
    onChange(reorder([...sorted, createScoreSlot("for_time", sorted.length)]))
  }
  const removeAt = (idx: number) => {
    onChange(reorder(sorted.filter((_, i) => i !== idx)))
  }
  const moveUp = (idx: number) => {
    if (idx === 0) return
    const next = sorted.slice()
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange(reorder(next))
  }
  const moveDown = (idx: number) => {
    if (idx >= sorted.length - 1) return
    const next = sorted.slice()
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onChange(reorder(next))
  }
  const updateAt = (idx: number, patch: Partial<ScoreSlot>) => {
    const next = sorted.slice()
    next[idx] = { ...next[idx], ...patch }
    onChange(next)
  }
  const changeScoreType = (idx: number, score_type: ScoreType) => {
    const next = sorted.slice()
    const current = next[idx]
    const updated: ScoreSlot = { ...current, score_type }
    if (score_type === "sets_reps_rm") {
      updated.prescription = current.prescription ?? [{ sets: 1, reps: 5 }]
    } else {
      delete updated.prescription
    }
    next[idx] = updated
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          Slots de score ({sorted.length})
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addSlot}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar slot
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Sin slots. La rutina será solo informativa (no se registrarán scores).
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((slot, idx) => (
            <li
              key={slot.id}
              className="space-y-2 rounded-md border border-border bg-card p-2"
            >
              <div className="flex items-center gap-1.5">
                <Input
                  placeholder='Ej: "Murph" o "Front rack push jerk"'
                  value={slot.name}
                  onChange={(e) => updateAt(idx, { name: e.target.value })}
                  maxLength={100}
                  className="flex-1"
                />
                <Select
                  value={slot.score_type}
                  onValueChange={(v) => changeScoreType(idx, v as ScoreType)}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCORE_TYPE_ORDER.map((t) => (
                      <SelectItem key={t} value={t}>
                        {SCORE_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  aria-label="Mover arriba"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => moveDown(idx)}
                  disabled={idx >= sorted.length - 1}
                  aria-label="Mover abajo"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive"
                  onClick={() => removeAt(idx)}
                  aria-label="Eliminar slot"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {slot.score_type === "sets_reps_rm" && (
                <PrescriptionEditor
                  prescription={slot.prescription ?? []}
                  onChange={(next) => updateAt(idx, { prescription: next })}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
