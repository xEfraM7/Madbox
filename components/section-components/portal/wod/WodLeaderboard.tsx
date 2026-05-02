"use client"

import { useQuery } from "@tanstack/react-query"
import { Trophy, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getTodayLeaderboard } from "@/lib/actions/wod-logs"
import { formatScore } from "@/lib/constants/wod-score"

const POSITION_BG = ["bg-yellow-400/10", "bg-slate-300/10", "bg-amber-700/10"]

export function WodLeaderboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["today-leaderboard"],
    queryFn: getTodayLeaderboard,
    staleTime: 60 * 1000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!data || !data.routine) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">
            Leaderboard de hoy
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {data.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aún nadie ha registrado el WOD de hoy. ¡Sé el primero!
          </p>
        ) : (
          <ul className="space-y-1.5">
            {data.entries.map((e) => {
              const initials = e.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
              const podium = e.position <= 3
              return (
                <li
                  key={e.member_id}
                  className={cn(
                    "flex items-center gap-3 px-2 py-1.5 rounded-md",
                    podium && POSITION_BG[e.position - 1],
                  )}
                >
                  <span className={cn(
                    "shrink-0 w-7 text-center text-xs font-bold tabular-nums",
                    podium ? "text-foreground" : "text-muted-foreground",
                  )}>
                    {e.position}°
                  </span>
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={e.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-muted text-foreground text-[10px] font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm flex-1 min-w-0 truncate">{e.name}</span>
                  <span className="text-sm font-bold tabular-nums shrink-0">
                    {formatScore({
                      score_type: e.score_type,
                      score_seconds: e.score_seconds,
                      score_rounds: e.score_rounds,
                      score_reps: e.score_reps,
                      score_kg: e.score_kg,
                    })}
                  </span>
                  <Badge variant={e.rx ? "default" : "outline"} className="text-[10px] shrink-0">
                    {e.rx ? "RX" : "S"}
                  </Badge>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
