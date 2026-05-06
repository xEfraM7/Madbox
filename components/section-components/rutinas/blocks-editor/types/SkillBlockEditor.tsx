"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { SkillBlock } from "@/lib/constants/routine-blocks"
import { MovementListEditor } from "../MovementListEditor"

interface Props {
  block: SkillBlock
  onChange: (next: SkillBlock) => void
}

export function SkillBlockEditor({ block, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Ejercicios</Label>
        <MovementListEditor
          movements={block.exercises}
          onChange={(exercises) => onChange({ ...block, exercises })}
          placeholder="Ej: handstand walk 5m"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notas (opcional)</Label>
        <Textarea
          rows={2}
          value={block.notes ?? ""}
          onChange={(e) => onChange({ ...block, notes: e.target.value })}
        />
      </div>
    </div>
  )
}
