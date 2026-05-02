"use client"

import { ChevronUp, ChevronDown, Trash2, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  type RoutineBlock,
  type BlockType,
  BLOCK_META,
  createBlock,
} from "@/lib/constants/routine-blocks"
import { BlockEditor } from "./block-editors"
import { BlockPicker } from "./BlockPicker"

interface RoutineBlockEditorProps {
  blocks: RoutineBlock[]
  onChange: (next: RoutineBlock[]) => void
  disabled?: boolean
}

function reorder(blocks: RoutineBlock[]): RoutineBlock[] {
  return blocks.map((b, i) => ({ ...b, order: i }))
}

export function RoutineBlockEditor({ blocks, onChange, disabled }: RoutineBlockEditorProps) {
  const sorted = [...blocks].sort((a, b) => a.order - b.order)

  const handleAdd = (type: BlockType) => {
    const next = [...sorted, createBlock(type, sorted.length)]
    onChange(reorder(next))
  }

  const handleRemove = (id: string) => {
    onChange(reorder(sorted.filter((b) => b.id !== id)))
  }

  const handleMove = (id: string, direction: "up" | "down") => {
    const idx = sorted.findIndex((b) => b.id === id)
    if (idx === -1) return
    const targetIdx = direction === "up" ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= sorted.length) return
    const next = [...sorted]
    ;[next[idx], next[targetIdx]] = [next[targetIdx], next[idx]]
    onChange(reorder(next))
  }

  const handleBlockChange = (id: string, updated: RoutineBlock) => {
    onChange(reorder(sorted.map((b) => (b.id === id ? updated : b))))
  }

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Esta rutina aún no tiene bloques.</p>
          <p className="text-xs text-muted-foreground">Agrega el primero para empezar.</p>
        </div>
      ) : (
        sorted.map((b, i) => {
          const meta = BLOCK_META[b.type]
          const Icon = meta.icon
          const isFirst = i === 0
          const isLast = i === sorted.length - 1
          return (
            <div key={b.id} className="border rounded-lg bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b">
                <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" aria-hidden="true" />
                <Icon className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-semibold flex-1 truncate">{meta.label}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {i + 1} de {sorted.length}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleMove(b.id, "up")}
                  disabled={isFirst || disabled}
                  aria-label="Subir bloque"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleMove(b.id, "down")}
                  disabled={isLast || disabled}
                  aria-label="Bajar bloque"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7 text-muted-foreground hover:text-destructive")}
                  onClick={() => handleRemove(b.id)}
                  disabled={disabled}
                  aria-label="Eliminar bloque"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-3">
                <BlockEditor block={b} onChange={(updated) => handleBlockChange(b.id, updated)} />
              </div>
            </div>
          )
        })
      )}

      <BlockPicker onPick={handleAdd} disabled={disabled} />
    </div>
  )
}
