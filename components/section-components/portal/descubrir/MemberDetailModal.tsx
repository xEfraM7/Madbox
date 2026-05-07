"use client"

import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Loader2, CalendarDays } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getMemberPublicProfile } from "@/lib/actions/records"
import { ATHLETE_LEVEL_LABEL } from "@/lib/constants/athlete"
import { getMemberRecentWods } from "@/lib/actions/wod-logs"
import {
  FAMILY_LABEL,
  FAMILY_ORDER,
  getMovementsByFamily,
  OLYMPIC_DISPLAY_MOVEMENTS,
  OLYMPIC_DISPLAY_LABEL,
} from "@/lib/constants/movements"
import { TotalsStrip } from "../perfil/totals-strip"
import { Flame } from "lucide-react"
import { formatScore } from "@/lib/constants/wod-score"

interface MemberDetailModalProps {
  memberId: string | null
  onClose: () => void
}

export function MemberDetailModal({ memberId, onClose }: MemberDetailModalProps) {
  const open = memberId !== null

  const { data: profile, isLoading } = useQuery({
    queryKey: ["member-public", memberId],
    queryFn: () => getMemberPublicProfile(memberId as string),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const { data: recentWods = [] } = useQuery({
    queryKey: ["member-recent-wods", memberId],
    queryFn: () => getMemberRecentWods(memberId as string, 5),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const initials = profile?.name
    ? profile.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?"

  const recordsByMovement = (() => {
    if (!profile) return {}
    const map: Record<string, number> = {}
    for (const r of profile.records) map[r.movement] = Number(r.weight_kg)
    return map
  })()

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Perfil del miembro</DialogTitle>
        </DialogHeader>

        {isLoading || !profile ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 border-2 border-primary/30">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-lg font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-bold truncate">{profile.name}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  {profile.plan_name && (
                    <Badge variant="outline" className="text-[11px]">
                      {profile.plan_name}
                    </Badge>
                  )}
                  {profile.start_date && (
                    <Badge variant="outline" className="text-[11px] gap-1">
                      <CalendarDays className="h-3 w-3" />
                      Desde {format(new Date(profile.start_date + "T00:00:00"), "MMM yyyy", { locale: es })}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {(profile.age !== null ||
              profile.weight_kg !== null ||
              profile.height_cm !== null ||
              profile.athlete_level !== null ||
              profile.athlete_since_year !== null ||
              profile.quote) && (
              <div className="border rounded-lg p-3 sm:p-4 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Datos del atleta
                </h3>
                {(profile.age !== null ||
                  profile.weight_kg !== null ||
                  profile.height_cm !== null ||
                  profile.athlete_level !== null) && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-center">
                    {profile.age !== null && (
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Edad</p>
                        <p className="text-base font-semibold tabular-nums">{profile.age}</p>
                        <p className="text-[10px] text-muted-foreground">años</p>
                      </div>
                    )}
                    {profile.weight_kg !== null && (
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Peso</p>
                        <p className="text-base font-semibold tabular-nums">{Number(profile.weight_kg).toLocaleString("es-VE")}</p>
                        <p className="text-[10px] text-muted-foreground">kg</p>
                      </div>
                    )}
                    {profile.height_cm !== null && (
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Altura</p>
                        <p className="text-base font-semibold tabular-nums">{Number(profile.height_cm).toLocaleString("es-VE")}</p>
                        <p className="text-[10px] text-muted-foreground">cm</p>
                      </div>
                    )}
                    {profile.athlete_level !== null && (
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Nivel</p>
                        <p className="text-base font-semibold">{ATHLETE_LEVEL_LABEL[profile.athlete_level]}</p>
                      </div>
                    )}
                  </div>
                )}
                {profile.athlete_since_year !== null && (
                  <p className="text-xs text-muted-foreground text-center">
                    Atleta desde {profile.athlete_since_year}
                  </p>
                )}
                {profile.quote && (
                  <p className="text-sm italic text-center pt-1">&ldquo;{profile.quote}&rdquo;</p>
                )}
              </div>
            )}

            {profile.totals === null ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Este miembro optó por no mostrar sus marcas.
              </p>
            ) : (
              <>
                <TotalsStrip totals={profile.totals} />

                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 sm:p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3 text-center">
                    Levantamientos Olímpicos
                  </h3>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                    {OLYMPIC_DISPLAY_MOVEMENTS.map((mv) => {
                      const w = recordsByMovement[mv]
                      return (
                        <div key={mv}>
                          <p className="text-[10px] sm:text-xs uppercase text-muted-foreground tracking-wide font-semibold">
                            {OLYMPIC_DISPLAY_LABEL[mv]}
                          </p>
                          <p className="text-2xl sm:text-3xl font-extrabold text-primary tabular-nums mt-1">
                            {w !== undefined && w > 0 ? w.toLocaleString("es-VE") : "—"}
                          </p>
                          {w !== undefined && w > 0 && (
                            <p className="text-[10px] text-muted-foreground tracking-wide">kg</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  {FAMILY_ORDER.map((family) => {
                    const movements = getMovementsByFamily(family)
                    if (movements.length === 0) return null
                    return (
                      <div key={family} className="border rounded-lg p-3 sm:p-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                          {FAMILY_LABEL[family]}
                        </h3>
                        <ul className="space-y-1.5">
                          {movements.map((m) => {
                            const w = recordsByMovement[m.id]
                            return (
                              <li
                                key={m.id}
                                className="flex items-center justify-between gap-3 text-sm"
                              >
                                <span className="truncate">{m.label}</span>
                                <span className="font-semibold tabular-nums shrink-0">
                                  {w !== undefined && w > 0
                                    ? `${w.toLocaleString("es-VE")} kg`
                                    : "—"}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>

                {recentWods.length > 0 && (
                  <div className="border rounded-lg p-3 sm:p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-primary" />
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        WODs recientes
                      </h3>
                    </div>
                    <ul className="space-y-1.5">
                      {recentWods.map((w) => (
                        <li key={w.id} className="flex items-center gap-3 text-sm">
                          <span className="text-xs text-muted-foreground w-16 shrink-0 tabular-nums">
                            {w.date.slice(5)}
                          </span>
                          <span className="flex-1 min-w-0 truncate">{w.routine_name}</span>
                          <span className="font-semibold tabular-nums shrink-0">
                            {formatScore({
                              score_type: w.score_type,
                              score_seconds: w.score_seconds,
                              score_rounds: w.score_rounds,
                              score_reps: w.score_reps,
                              score_kg: w.score_kg,
                              score_weights: w.score_weights,
                            })}
                          </span>
                          <Badge variant={w.rx ? "default" : "outline"} className="text-[10px] shrink-0">
                            {w.rx ? "RX" : "S"}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
