"use client"

import { useQuery } from "@tanstack/react-query"
import { Loader2, ChevronRight } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getTopByCategory } from "@/lib/actions/records"
import type { Gender } from "@/lib/constants/athlete"

interface Props {
  gender: Gender
  onSelect: (memberId: string) => void
}

export function Top10Leaderboard({ gender, onSelect }: Props) {
  const { data: top = [], isLoading } = useQuery({
    queryKey: ["discover-top", "grand", gender, 10],
    queryFn: () => getTopByCategory("grand", gender, 10),
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

  const rest = top.slice(3)

  if (rest.length === 0) return null

  return (
    <Card>
      <CardContent className="py-3 sm:py-4">
        <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Posiciones 4 — {3 + rest.length}
        </p>
        <ul className="divide-y divide-border">
          {rest.map((entry, i) => {
            const position = i + 4
            const initials = entry.name
              .split(" ").map((n) => n.charAt(0)).join("").slice(0, 2).toUpperCase()
            return (
              <li key={entry.member_id}>
                <button
                  type="button"
                  onClick={() => onSelect(entry.member_id)}
                  className={cn(
                    "w-full flex items-center gap-3 py-2.5 sm:py-3 px-1 text-left",
                    "transition-colors hover:bg-muted/40 rounded-md",
                  )}
                >
                  <span className="text-sm sm:text-base font-bold tabular-nums text-muted-foreground w-7 text-center shrink-0">
                    {position}
                  </span>
                  <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
                    <AvatarImage src={entry.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 min-w-0 text-sm font-medium truncate">
                    {entry.name}
                  </span>
                  <span className="text-sm sm:text-base font-bold tabular-nums shrink-0">
                    {entry.total_kg.toLocaleString("es-VE")}
                    <span className="text-[10px] font-normal text-muted-foreground ml-0.5">kg</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
