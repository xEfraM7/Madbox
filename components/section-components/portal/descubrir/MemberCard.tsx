"use client"

import { Trophy } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { OLYMPIC_DISPLAY_LABEL, type MovementId } from "@/lib/constants/movements"
import type { DiscoverableMember } from "@/lib/actions/records"
import type { Gender } from "@/lib/constants/athlete"

interface MemberCardProps {
  member: DiscoverableMember
  gender: Gender
  onClick: () => void
}

export function MemberCard({ member, gender, onClick }: MemberCardProps) {
  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const ringClass = gender === "male" ? "ring-2 ring-blue-500/30" : "ring-2 ring-pink-500/30"

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer transition-colors hover:border-primary/40"
    >
      <CardContent className="py-4 sm:py-5 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className={cn("h-12 w-12 sm:h-14 sm:w-14 shrink-0 border-2 border-primary/20", ringClass)}>
            <AvatarImage src={member.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{member.name}</p>
            {member.plan_name && (
              <Badge variant="outline" className="mt-1 text-[10px]">
                {member.plan_name}
              </Badge>
            )}
          </div>
        </div>

        {member.totals && member.totals.grand > 0 && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-primary/5">
            <Trophy className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground">Grand Total</span>
            <span className="ml-auto text-sm font-bold tabular-nums">
              {member.totals.grand.toLocaleString("es-VE")}
              <span className="text-[10px] font-normal text-muted-foreground ml-0.5">kg</span>
            </span>
          </div>
        )}

        {member.totals === null ? (
          <p className="text-xs text-muted-foreground italic pt-1">Marcas privadas</p>
        ) : member.top_records.length > 0 ? (
          <ul className="space-y-1 pt-1">
            {member.top_records.map((r) => (
              <li
                key={r.movement}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-muted-foreground truncate">
                  {OLYMPIC_DISPLAY_LABEL[r.movement as MovementId]}
                </span>
                <span className="font-semibold tabular-nums shrink-0">
                  {r.weight_kg > 0 ? `${r.weight_kg.toLocaleString("es-VE")} kg` : "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground italic pt-1">
            Sin marcas registradas
          </p>
        )}
      </CardContent>
    </Card>
  )
}
