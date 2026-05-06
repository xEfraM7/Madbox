"use client"

import { Badge } from "@/components/ui/badge"
import { BLOCK_META, type RoutineBlock } from "@/lib/constants/routine-blocks"

interface Props {
  block: RoutineBlock
}

export function InfoBlockCard({ block }: Props) {
  const meta = BLOCK_META[block.type]
  const Icon = meta.icon

  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1 text-[10px]">
          <Icon className="h-3 w-3" /> {meta.label.toUpperCase()}
        </Badge>
      </div>
      <BlockBody block={block} />
    </div>
  )
}

function BlockBody({ block }: { block: RoutineBlock }) {
  switch (block.type) {
    case "warmup":
    case "cooldown":
    case "notes":
      return <p className="text-xs text-muted-foreground whitespace-pre-wrap">{block.text}</p>
    case "skill":
      return (
        <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
          {block.exercises.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )
    default:
      return null
  }
}
