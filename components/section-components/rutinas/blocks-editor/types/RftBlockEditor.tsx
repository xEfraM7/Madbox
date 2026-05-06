"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { RftBlock } from "@/lib/constants/routine-blocks"
import { MovementListEditor } from "../MovementListEditor"

interface Props {
  block: RftBlock
  onChange: (next: RftBlock) => void
}

export function RftBlockEditor({ block, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Rounds</Label>
        <Input
          type="number"
          min={1}
          max={50}
          value={block.rounds}
          onChange={(e) => onChange({ ...block, rounds: Number(e.target.value) || 1 })}
          className="w-24"
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
