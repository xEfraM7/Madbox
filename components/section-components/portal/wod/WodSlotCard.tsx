"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  formatScore,
  SCORE_TYPE_LABEL,
} from "@/lib/constants/wod-score"
import type { ScoreSlot } from "@/lib/constants/score-slots"
import type { WodLog } from "@/lib/actions/wod-logs"
import { LogWodModal } from "./log-wod-modal"
import { WodMiniLeaderboard } from "./WodMiniLeaderboard"
import { WodFullLeaderboardSheet } from "./WodFullLeaderboardSheet"

interface Props {
  routineId: string
  slot: ScoreSlot
  myLog: WodLog | null
  defaultGender: "male" | "female"
  myMemberId: string
}

export function WodSlotCard({ routineId, slot, myLog, defaultGender, myMemberId }: Props) {
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const scoreTypeLabel = SCORE_TYPE_LABEL[slot.score_type]

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="default" className="gap-1">
          {scoreTypeLabel.toUpperCase()}
        </Badge>
        <span className="text-sm font-semibold flex-1 truncate">{slot.name}</span>
        {myLog && (
          <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-500">
            LOGEADO
          </Badge>
        )}
      </div>

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
          Registrar {scoreTypeLabel}
        </Button>
      )}

      <WodMiniLeaderboard
        routineId={routineId}
        slotId={slot.id}
        defaultGender={defaultGender}
        onOpenFull={() => setSheetOpen(true)}
        highlightMemberId={myMemberId}
      />

      <LogWodModal
        open={logModalOpen}
        onOpenChange={setLogModalOpen}
        routineId={routineId}
        slot={slot}
        existingLog={myLog}
      />

      <WodFullLeaderboardSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        routineId={routineId}
        slotId={slot.id}
        slotLabel={slot.name}
        defaultGender={defaultGender}
        highlightMemberId={myMemberId}
      />
    </div>
  )
}
