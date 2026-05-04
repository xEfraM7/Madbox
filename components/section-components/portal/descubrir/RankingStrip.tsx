"use client"

import { useQuery } from "@tanstack/react-query"
import { Trophy, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getTopByCategory } from "@/lib/actions/records"
import type { Gender } from "@/lib/constants/athlete"

const POSITION_STYLES = [
  { ring: "ring-yellow-400", bg: "bg-yellow-400/10", label: "1°", scale: "scale-110" },
  { ring: "ring-slate-300",  bg: "bg-slate-300/10",  label: "2°", scale: "" },
  { ring: "ring-amber-700",  bg: "bg-amber-700/10",  label: "3°", scale: "" },
]

interface Props {
  gender: Gender
}

export function RankingStrip({ gender }: Props) {
  const { data: top = [], isLoading } = useQuery({
    queryKey: ["discover-top", "grand", gender],
    queryFn: () => getTopByCategory("grand", gender),
    staleTime: 5 * 60 * 1000,
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

  if (top.length === 0) return null

  const title = gender === "male" ? "Top Grand Total — Masculino" : "Top Grand Total — Femenino"

  return (
    <Card>
      <CardContent className="py-4 sm:py-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-primary" />
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide">
            {title}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {top.map((entry, i) => {
            const styles = POSITION_STYLES[i] ?? POSITION_STYLES[2]
            const initials = entry.name
              .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
            return (
              <div
                key={entry.member_id}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-2 sm:p-3 rounded-lg",
                  styles.bg,
                )}
              >
                <Avatar
                  className={cn(
                    "h-12 w-12 sm:h-14 sm:w-14 ring-2 transition-transform",
                    styles.ring,
                    styles.scale,
                  )}
                >
                  <AvatarImage src={entry.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-muted text-foreground text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">
                  {styles.label}
                </p>
                <p className="text-xs sm:text-sm font-medium text-center truncate max-w-full">
                  {entry.name}
                </p>
                <p className="text-sm sm:text-base font-bold tabular-nums">
                  {entry.total_kg.toLocaleString("es-VE")}
                  <span className="text-[10px] font-normal text-muted-foreground ml-0.5">kg</span>
                </p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
