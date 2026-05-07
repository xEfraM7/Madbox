"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  computeVolume,
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
  const isStrengthWave = slot.score_type === "sets_reps_rm"
  const prescription = slot.prescription
  const myWeights = myLog?.score_weights ?? null

  const volume =
    isStrengthWave && prescription && myWeights && myWeights.length === prescription.length
      ? computeVolume(myWeights, prescription)
      : null

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

      {isStrengthWave && prescription && prescription.length > 0 && (
        <div className="rounded-md border border-border bg-background/40 p-2.5 space-y-1">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>Prescripción</span>
            {myWeights && <span>Tu peso</span>}
          </div>
          {prescription.map((row, idx) => {
            const w = myWeights?.[idx]
            return (
              <div
                key={idx}
                className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm"
              >
                <span className="tabular-nums">
                  {row.sets} × {row.reps}
                  {typeof row.percent === "number" ? (
                    <span className="text-muted-foreground"> @ {row.percent}%</span>
                  ) : null}
                </span>
                {typeof w === "number" && (
                  <span className="font-bold tabular-nums text-primary">
                    {w.toLocaleString("es-VE")} kg
                  </span>
                )}
              </div>
            )
          })}
          {volume !== null && (
            <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5 text-sm">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Volumen total
              </span>
              <span className="font-bold tabular-nums text-primary">
                {volume.toLocaleString("es-VE")} kg
              </span>
            </div>
          )}
        </div>
      )}

      {myLog && !isStrengthWave ? (
        <div className="flex items-center gap-2 rounded-md bg-background/40 px-3 py-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Tu marca</span>
          <span className="text-base font-bold tabular-nums text-primary">
            {formatScore({
              score_type: myLog.score_type,
              score_seconds: myLog.score_seconds,
              score_rounds: myLog.score_rounds,
              score_reps: myLog.score_reps,
              score_kg: myLog.score_kg,
              score_weights: myLog.score_weights,
            }, prescription)}
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
      ) : myLog && isStrengthWave ? (
        <div className="flex items-center justify-end">
          {myLog.rx && (
            <Badge variant="default" className="text-[10px] mr-2">RX</Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
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
        prescription={prescription}
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
        prescription={prescription}
      />
    </div>
  )
}
