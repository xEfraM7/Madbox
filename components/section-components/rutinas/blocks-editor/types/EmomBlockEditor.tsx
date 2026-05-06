"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { EmomBlock } from "@/lib/constants/routine-blocks"
import { MovementListEditor } from "../MovementListEditor"

interface Props {
  block: EmomBlock
  onChange: (next: EmomBlock) => void
}

export function EmomBlockEditor({ block, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-3">
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
        <label className="flex items-center gap-2 text-xs pb-2">
          <Switch
            checked={block.alternating}
            onCheckedChange={(v) => onChange({ ...block, alternating: v })}
          />
          Alternante
        </label>
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
