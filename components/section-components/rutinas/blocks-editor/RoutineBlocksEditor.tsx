"use client"

import { useMemo } from "react"
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  BLOCK_META,
  BLOCK_TYPE_ORDER,
  CONDITIONING_SCORE_TYPE,
  createBlock,
  type BlockType,
  type RoutineBlock,
} from "@/lib/constants/routine-blocks"
import { SCORE_TYPE_LABEL } from "@/lib/constants/wod-score"
import { TextBlockEditor } from "./types/TextBlockEditor"
import { StrengthBlockEditor } from "./types/StrengthBlockEditor"
import { SkillBlockEditor } from "./types/SkillBlockEditor"
import { AmrapBlockEditor } from "./types/AmrapBlockEditor"
import { EmomBlockEditor } from "./types/EmomBlockEditor"
import { ForTimeBlockEditor } from "./types/ForTimeBlockEditor"
import { ForRepsBlockEditor } from "./types/ForRepsBlockEditor"
import { RftBlockEditor } from "./types/RftBlockEditor"

interface Props {
  blocks: RoutineBlock[]
  onChange: (next: RoutineBlock[]) => void
}

export function RoutineBlocksEditor({ blocks, onChange }: Props) {
  const sorted = useMemo(
    () => [...blocks].sort((a, b) => a.order - b.order),
    [blocks],
  )

  const addBlock = (type: BlockType) => {
    const next = [...sorted, createBlock(type, sorted.length)]
    onChange(reorder(next))
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

  const updateBlock = (idx: number, updated: RoutineBlock) => {
    const next = sorted.slice()
    next[idx] = updated
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          Bloques ({sorted.length})
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" type="button" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Agregar bloque
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {BLOCK_TYPE_ORDER.map((t) => {
              const meta = BLOCK_META[t]
              const Icon = meta.icon
              return (
                <DropdownMenuItem key={t} onClick={() => addBlock(t)} className="gap-2">
                  <Icon className="h-3.5 w-3.5" /> {meta.label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {sorted.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Aún no hay bloques. Empieza agregando uno.
          </p>
        </div>
      )}

      {sorted.map((block, idx) => {
        const meta = BLOCK_META[block.type]
        const Icon = meta.icon
        const scoreType = CONDITIONING_SCORE_TYPE[block.type]
        const isLoggable = !!scoreType
        return (
          <div
            key={block.id}
            className={cn(
              "rounded-lg border p-3 space-y-2",
              isLoggable
                ? "border-primary/40 ring-1 ring-primary/15 bg-primary/[0.03]"
                : "border-border bg-card",
            )}
          >
            <div className="flex items-center gap-2">
              <Badge variant={isLoggable ? "default" : "secondary"} className="gap-1">
                <Icon className="h-3 w-3" /> {meta.label.toUpperCase()}
              </Badge>
              {isLoggable && scoreType && (
                <Badge variant="outline" className="text-[10px] gap-1 border-primary/40 text-primary">
                  LOG: {SCORE_TYPE_LABEL[scoreType]}
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => moveDown(idx)}
                  disabled={idx >= sorted.length - 1}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeAt(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <BlockBody block={block} onChange={(b) => updateBlock(idx, b)} />
          </div>
        )
      })}
    </div>
  )
}

function reorder(blocks: RoutineBlock[]): RoutineBlock[] {
  return blocks.map((b, i) => ({ ...b, order: i }))
}

function BlockBody({
  block,
  onChange,
}: {
  block: RoutineBlock
  onChange: (b: RoutineBlock) => void
}) {
  switch (block.type) {
    case "warmup":
      return <TextBlockEditor block={block} placeholder="Ej: 3 rounds: 200m row + 10 air squats" onChange={onChange} />
    case "cooldown":
      return <TextBlockEditor block={block} placeholder="Ej: 5 min foam roll + estiramientos" onChange={onChange} />
    case "notes":
      return <TextBlockEditor block={block} placeholder="Notas adicionales (Markdown)…" onChange={onChange} />
    case "strength":
      return <StrengthBlockEditor block={block} onChange={onChange} />
    case "skill":
      return <SkillBlockEditor block={block} onChange={onChange} />
    case "amrap":
      return <AmrapBlockEditor block={block} onChange={onChange} />
    case "emom":
      return <EmomBlockEditor block={block} onChange={onChange} />
    case "for_time":
      return <ForTimeBlockEditor block={block} onChange={onChange} />
    case "for_reps":
      return <ForRepsBlockEditor block={block} onChange={onChange} />
    case "rft":
      return <RftBlockEditor block={block} onChange={onChange} />
  }
}
