"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AmrapBlock } from "@/lib/constants/routine-blocks"
import { MovementListEditor } from "../MovementListEditor"

interface Props {
  block: AmrapBlock
  onChange: (next: AmrapBlock) => void
}

export function AmrapBlockEditor({ block, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Minutos</Label>
          <Input
            type="number"
            min={1}
            max={120}
            value={block.minutes}
            onChange={(e) => onChange({ ...block, minutes: Number(e.target.value) || 1 })}
            className="w-20"
          />
        </div>
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
