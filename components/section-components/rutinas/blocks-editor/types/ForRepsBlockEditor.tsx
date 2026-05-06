"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ForRepsBlock } from "@/lib/constants/routine-blocks"
import { MovementListEditor } from "../MovementListEditor"

interface Props {
  block: ForRepsBlock
  onChange: (next: ForRepsBlock) => void
}

export function ForRepsBlockEditor({ block, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Target reps</Label>
        <Input
          type="number"
          min={1}
          max={99999}
          value={block.target_reps}
          onChange={(e) => onChange({ ...block, target_reps: Number(e.target.value) || 1 })}
          className="w-32"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Movimientos</Label>
        <MovementListEditor
          movements={block.movements}
          onChange={(movements) => onChange({ ...block, movements })}
        />
      </div>
    </div>
  )
}
