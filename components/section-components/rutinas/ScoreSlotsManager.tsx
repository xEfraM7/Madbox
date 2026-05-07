"use client"

import { useMemo } from "react"
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
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
              className="flex items-center gap-1.5 rounded-md border border-border bg-card p-2"
            >
              <Input
                placeholder='Ej: "Murph" o "Back Squat 5RM"'
                value={slot.name}
                onChange={(e) => updateAt(idx, { name: e.target.value })}
                maxLength={100}
                className="flex-1"
              />
              <Select
                value={slot.score_type}
                onValueChange={(v) => updateAt(idx, { score_type: v as ScoreType })}
              >
                <SelectTrigger className="w-32">
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
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive"
                onClick={() => removeAt(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
