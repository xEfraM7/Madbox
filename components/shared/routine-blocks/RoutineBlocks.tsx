"use client"

import { cn } from "@/lib/utils"
import {
  type RoutineBlock,
  type BlockType,
  BLOCK_META,
  parseBlocks,
} from "@/lib/constants/routine-blocks"

// ─── Subcomponentes por tipo ─────────────────────────────

function MovementsList({ items }: { items: string[] }) {
  const list = items.filter((m) => m.trim())
  if (list.length === 0) return <p className="text-xs text-muted-foreground italic">Sin movimientos</p>
  return (
    <ul className="space-y-0.5 text-sm">
      {list.map((m, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-muted-foreground">•</span>
          <span>{m}</span>
        </li>
      ))}
    </ul>
  )
}

function FreeTextBody({ text }: { text: string }) {
  if (!text.trim()) return <p className="text-xs text-muted-foreground italic">Sin contenido</p>
  return (
    <div className="text-sm whitespace-pre-wrap">{text}</div>
  )
}

function BlockHeader({ type, headline }: { type: BlockType; headline?: string }) {
  const meta = BLOCK_META[type]
  const Icon = meta.icon
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="h-4 w-4 text-primary" />
      <h4 className="text-sm font-bold">
        {meta.label}
        {headline && <span className="text-muted-foreground font-normal ml-1.5">· {headline}</span>}
      </h4>
    </div>
  )
}

function BlockCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-3 sm:p-4 bg-card/50">
      {children}
    </div>
  )
}

function BlockBody(block: RoutineBlock): { headline?: string; content: React.ReactNode } {
  switch (block.type) {
    case "warmup":
    case "cooldown":
    case "notes":
      return { content: <FreeTextBody text={block.text} /> }

    case "strength": {
      const headline = block.exercise || "(sin ejercicio)"
      const setsReps = `${block.sets} × ${block.reps}`
      const weight = block.weight ? ` @ ${block.weight}` : ""
      return {
        headline,
        content: (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold tabular-nums">{setsReps}{weight}</p>
            {block.notes && <p className="text-xs text-muted-foreground">{block.notes}</p>}
          </div>
        ),
      }
    }

    case "skill":
      return {
        content: (
          <div className="space-y-2">
            <MovementsList items={block.exercises} />
            {block.notes && <p className="text-xs text-muted-foreground">{block.notes}</p>}
          </div>
        ),
      }

    case "amrap":
      return {
        headline: `${block.minutes} min`,
        content: <MovementsList items={block.movements} />,
      }

    case "emom":
      return {
        headline: `${block.minutes} min${block.alternating ? " · alternando" : ""}`,
        content: <MovementsList items={block.movements} />,
      }

    case "for_time": {
      const cap = block.time_cap_min ? ` · cap ${block.time_cap_min} min` : ""
      return {
        headline: `${cap.trim() || ""}`.trim() || undefined,
        content: <MovementsList items={block.movements} />,
      }
    }

    case "for_reps":
      return {
        headline: `${block.target_reps} reps`,
        content: <MovementsList items={block.movements} />,
      }

    case "rft":
      return {
        headline: `${block.rounds} rounds`,
        content: <MovementsList items={block.movements} />,
      }
  }
}

// ─── Componente principal ────────────────────────────────

interface RoutineBlocksProps {
  blocks: unknown
  className?: string
  emptyMessage?: string
}

export function RoutineBlocks({ blocks, className, emptyMessage }: RoutineBlocksProps) {
  const list = parseBlocks(blocks).sort((a, b) => a.order - b.order)
  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        {emptyMessage ?? "Sin contenido"}
      </p>
    )
  }
  return (
    <div className={cn("space-y-3", className)}>
      {list.map((b) => {
        const { headline, content } = BlockBody(b)
        return (
          <BlockCard key={b.id}>
            <BlockHeader type={b.type} headline={headline} />
            {content}
          </BlockCard>
        )
      })}
    </div>
  )
}
