"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { StickyNote } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatScore } from "@/lib/constants/wod-score"
import type { WodLog } from "@/lib/actions/wod-logs"

interface WodLogRowProps {
  log: WodLog
  onClick: () => void
}

export function WodLogRow({ log, onClick }: WodLogRowProps) {
  const dateObj = new Date(log.date + "T00:00:00")
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2.5 px-3 -mx-3 rounded hover:bg-muted/30 transition-colors text-left"
    >
      <div className="shrink-0 text-center w-10">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          {format(dateObj, "MMM", { locale: es })}
        </p>
        <p className="text-base font-bold tabular-nums">
          {format(dateObj, "d", { locale: es })}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{log.routine_name || "(rutina)"}</p>
        <p className="text-xs text-muted-foreground">
          {format(dateObj, "EEEE", { locale: es })}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {log.notes && <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-sm font-bold tabular-nums">
          {formatScore({
            score_type: log.score_type,
            score_seconds: log.score_seconds,
            score_rounds: log.score_rounds,
            score_reps: log.score_reps,
            score_kg: log.score_kg,
          })}
        </span>
        <Badge variant={log.rx ? "default" : "outline"} className="text-[10px]">
          {log.rx ? "RX" : "S"}
        </Badge>
      </div>
    </button>
  )
}
