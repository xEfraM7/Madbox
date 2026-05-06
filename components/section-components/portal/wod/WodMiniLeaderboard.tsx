"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Trophy, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getLeaderboardForBlock } from "@/lib/actions/wod-logs"
import { formatScore } from "@/lib/constants/wod-score"

interface Props {
  routineId: string
  blockId: string
  defaultGender: "male" | "female"
  onOpenFull: () => void
  highlightMemberId?: string
}

export function WodMiniLeaderboard({
  routineId,
  blockId,
  defaultGender,
  onOpenFull,
  highlightMemberId,
}: Props) {
  const [gender, setGender] = useState<"male" | "female">(defaultGender)

  const { data, isLoading } = useQuery({
    queryKey: ["wod-leaderboard", routineId, blockId, gender],
    queryFn: () =>
      getLeaderboardForBlock({ routine_id: routineId, block_id: blockId, gender, limit: 3 }),
    staleTime: 5 * 60 * 1000,
  })

  const entries = data?.entries ?? []

  return (
    <div className="rounded-md border border-border bg-background/40 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <Trophy className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
          Top {gender === "male" ? "Hombres" : "Mujeres"}
        </span>
        <div className="ml-auto flex gap-0.5 rounded-md bg-muted/40 p-0.5">
          <button
            onClick={() => setGender("male")}
            className={cn(
              "px-1.5 py-0.5 text-[10px] font-bold rounded",
              gender === "male" ? "bg-foreground/10 text-foreground" : "text-muted-foreground",
            )}
          >M</button>
          <button
            onClick={() => setGender("female")}
            className={cn(
              "px-1.5 py-0.5 text-[10px] font-bold rounded",
              gender === "female" ? "bg-foreground/10 text-foreground" : "text-muted-foreground",
            )}
          >F</button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic text-center py-2">
          Aún nadie ha registrado este bloque.
        </p>
      ) : (
        <ul className="space-y-1">
          {entries.map((e) => {
            const initials = e.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
            const isMe = e.member_id === highlightMemberId
            return (
              <li
                key={e.member_id}
                className={cn(
                  "flex items-center gap-2 px-1.5 py-1 rounded",
                  e.position === 1 && "bg-primary/10",
                  isMe && "ring-1 ring-primary/30",
                )}
              >
                <span className="w-5 text-center text-[10px] font-bold tabular-nums text-primary">
                  {e.position}°
                </span>
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={e.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-muted text-foreground text-[9px] font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs flex-1 min-w-0 truncate">
                  {e.name}{isMe && <span className="text-muted-foreground ml-1">(tú)</span>}
                </span>
                <span className="text-xs font-bold tabular-nums">
                  {formatScore({
                    score_type: e.score_type,
                    score_seconds: e.score_seconds,
                    score_rounds: e.score_rounds,
                    score_reps: e.score_reps,
                    score_kg: e.score_kg,
                  })}
                </span>
                {e.rx && <Badge variant="default" className="text-[9px] px-1 py-0">RX</Badge>}
              </li>
            )
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full h-7 text-xs text-muted-foreground"
        onClick={onOpenFull}
      >
        Ver Top 10
      </Button>
    </div>
  )
}
