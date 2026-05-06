"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { StrengthBlock } from "@/lib/constants/routine-blocks"

interface Props {
  block: StrengthBlock
  onChange: (next: StrengthBlock) => void
}

export function StrengthBlockEditor({ block, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Ejercicio</Label>
          <Input
            placeholder="Back Squat"
            value={block.exercise}
            onChange={(e) => onChange({ ...block, exercise: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sets</Label>
          <Input
            type="number"
            min={1}
            max={20}
            value={block.sets}
            onChange={(e) => onChange({ ...block, sets: Number(e.target.value) || 1 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Reps</Label>
          <Input
            placeholder="5"
            value={block.reps}
            onChange={(e) => onChange({ ...block, reps: e.target.value })}
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Peso (opcional)</Label>
          <Input
            placeholder="@ 80% 1RM"
            value={block.weight ?? ""}
            onChange={(e) => onChange({ ...block, weight: e.target.value })}
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Notas (opcional)</Label>
          <Textarea
            rows={2}
            placeholder="Ej: foco en técnica…"
            value={block.notes ?? ""}
            onChange={(e) => onChange({ ...block, notes: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
