"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ForTimeBlock } from "@/lib/constants/routine-blocks"
import { MovementListEditor } from "../MovementListEditor"

interface Props {
  block: ForTimeBlock
  onChange: (next: ForTimeBlock) => void
}

export function ForTimeBlockEditor({ block, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Time cap (min, opcional)</Label>
          <Input
            type="number"
            min={1}
            max={120}
            value={block.time_cap_min ?? ""}
            onChange={(e) =>
              onChange({
                ...block,
                time_cap_min: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-24"
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
