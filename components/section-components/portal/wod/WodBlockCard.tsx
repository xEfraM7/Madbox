"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  BLOCK_META,
  CONDITIONING_SCORE_TYPE,
  type RoutineBlock,
} from "@/lib/constants/routine-blocks"
import {
  formatScore,
  SCORE_TYPE_LABEL,
  type ScoreType,
} from "@/lib/constants/wod-score"
import type { WodLog } from "@/lib/actions/wod-logs"
import { LogWodModal } from "./log-wod-modal"
import { WodMiniLeaderboard } from "./WodMiniLeaderboard"
import { WodFullLeaderboardSheet } from "./WodFullLeaderboardSheet"

interface Props {
  routineId: string
  block: RoutineBlock
  myLog: WodLog | null
  defaultGender: "male" | "female"
  myMemberId: string
}

function blockHeadline(block: RoutineBlock): string {
  switch (block.type) {
    case "amrap": return `${BLOCK_META.amrap.label} ${block.minutes} min`
    case "for_time": return BLOCK_META.for_time.label + (block.time_cap_min ? ` · cap ${block.time_cap_min} min` : "")
    case "rft": return `${BLOCK_META.rft.label} · ${block.rounds} rounds`
    case "for_reps": return `${BLOCK_META.for_reps.label} · ${block.target_reps} reps`
    case "strength": return `${BLOCK_META.strength.label}: ${block.exercise || ""}`
    default: return BLOCK_META[block.type].label
  }
}

function blockBody(block: RoutineBlock): string[] {
  switch (block.type) {
    case "amrap":
    case "emom":
    case "for_time":
    case "for_reps":
    case "rft":
      return block.movements
    case "strength":
      return [`${block.sets} × ${block.reps}${block.weight ? ` · ${block.weight}` : ""}`]
    default:
      return []
  }
}

export function WodBlockCard({ routineId, block, myLog, defaultGender, myMemberId }: Props) {
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const scoreType = CONDITIONING_SCORE_TYPE[block.type] as ScoreType | undefined
  if (!scoreType) return null

  const meta = BLOCK_META[block.type]
  const Icon = meta.icon
  const lines = blockBody(block)

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="default" className="gap-1">
          <Icon className="h-3 w-3" /> {meta.label.toUpperCase()}
        </Badge>
        <span className="text-sm font-semibold flex-1 truncate">{blockHeadline(block)}</span>
        {myLog && (
          <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-500">
            LOGEADO
          </Badge>
        )}
      </div>

      {lines.length > 0 && (
        <ul className="text-sm text-muted-foreground space-y-0.5">
          {lines.map((m, i) => <li key={i}>· {m}</li>)}
        </ul>
      )}

      {myLog ? (
        <div className="flex items-center gap-2 rounded-md bg-background/40 px-3 py-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Tu marca</span>
          <span className="text-base font-bold tabular-nums text-primary">
            {formatScore({
              score_type: myLog.score_type,
              score_seconds: myLog.score_seconds,
              score_rounds: myLog.score_rounds,
              score_reps: myLog.score_reps,
              score_kg: myLog.score_kg,
            })}
          </span>
          {myLog.rx && (
            <Badge variant="default" className="text-[10px]">RX</Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-7 gap-1 text-xs"
            onClick={() => setLogModalOpen(true)}
          >
            <Pencil className="h-3 w-3" /> Editar
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          className="w-full gap-2"
          onClick={() => setLogModalOpen(true)}
        >
          Registrar {SCORE_TYPE_LABEL[scoreType]}
        </Button>
      )}

      <WodMiniLeaderboard
        routineId={routineId}
        blockId={block.id}
        defaultGender={defaultGender}
        onOpenFull={() => setSheetOpen(true)}
        highlightMemberId={myMemberId}
      />

      <LogWodModal
        open={logModalOpen}
        onOpenChange={setLogModalOpen}
        routineId={routineId}
        block={block}
        scoreType={scoreType}
        existingLog={myLog}
      />

      <WodFullLeaderboardSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        routineId={routineId}
        blockId={block.id}
        blockLabel={blockHeadline(block)}
        defaultGender={defaultGender}
        highlightMemberId={myMemberId}
      />
    </div>
  )
}
