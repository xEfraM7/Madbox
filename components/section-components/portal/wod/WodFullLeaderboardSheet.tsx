"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, Trophy } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getLeaderboardForSlot } from "@/lib/actions/wod-logs"
import { formatScore, type Prescription } from "@/lib/constants/wod-score"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  routineId: string
  slotId: string
  slotLabel: string
  defaultGender: "male" | "female"
  highlightMemberId?: string
  prescription?: Prescription
}

export function WodFullLeaderboardSheet({
  open,
  onOpenChange,
  routineId,
  slotId,
  slotLabel,
  defaultGender,
  highlightMemberId,
  prescription,
}: Props) {
  const [gender, setGender] = useState<"male" | "female">(defaultGender)

  const { data, isLoading } = useQuery({
    queryKey: ["wod-leaderboard", routineId, slotId, gender, "full"],
    queryFn: () =>
      getLeaderboardForSlot({ routine_id: routineId, slot_id: slotId, gender, limit: 10 }),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })

  const entries = data?.entries ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> Top 10
          </SheetTitle>
          <SheetDescription>{slotLabel}</SheetDescription>
        </SheetHeader>

        <div className="mt-3 flex gap-1 rounded-md bg-muted/40 p-1 w-fit">
          <button
            onClick={() => setGender("male")}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded",
              gender === "male" ? "bg-foreground/10 text-foreground" : "text-muted-foreground",
            )}
          >Hombres</button>
          <button
            onClick={() => setGender("female")}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded",
              gender === "female" ? "bg-foreground/10 text-foreground" : "text-muted-foreground",
            )}
          >Mujeres</button>
        </div>

        <div className="mt-4 space-y-1.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 italic">
              Aún nadie ha registrado este slot hoy.
            </p>
          ) : (
            entries.map((e) => {
              const initials = e.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
              const isMe = e.member_id === highlightMemberId
              return (
                <div
                  key={e.member_id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-md",
                    e.position === 1 && "bg-primary/10",
                    e.position === 2 && "bg-zinc-300/5",
                    e.position === 3 && "bg-amber-700/10",
                    isMe && "ring-1 ring-primary/40",
                  )}
                >
                  <span className="w-7 text-center text-sm font-bold tabular-nums text-primary">
                    {e.position}°
                  </span>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={e.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-muted text-foreground text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-sm truncate">
                    {e.name}{isMe && <span className="text-muted-foreground ml-1">(tú)</span>}
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    {formatScore({
                      score_type: e.score_type,
                      score_seconds: e.score_seconds,
                      score_rounds: e.score_rounds,
                      score_reps: e.score_reps,
                      score_kg: e.score_kg,
                      score_weights: e.score_weights,
                    }, prescription)}
                  </span>
                  <Badge variant={e.rx ? "default" : "outline"} className="text-[10px]">
                    {e.rx ? "RX" : "S"}
                  </Badge>
                </div>
              )
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
