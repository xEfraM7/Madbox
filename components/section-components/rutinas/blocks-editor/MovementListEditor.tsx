"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"

interface Props {
  movements: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}

export function MovementListEditor({ movements, onChange, placeholder = "Movimiento" }: Props) {
  const setAt = (idx: number, value: string) => {
    const next = movements.slice()
    next[idx] = value
    onChange(next)
  }
  const removeAt = (idx: number) => {
    onChange(movements.filter((_, i) => i !== idx))
  }
  const add = () => onChange([...movements, ""])

  return (
    <div className="space-y-1.5">
      {movements.map((m, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <Input
            placeholder={placeholder}
            value={m}
            onChange={(e) => setAt(idx, e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground"
            onClick={() => removeAt(idx)}
            disabled={movements.length <= 1}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="w-full gap-1 border-dashed"
      >
        <Plus className="h-3.5 w-3.5" />
        Movimiento
      </Button>
    </div>
  )
}
