"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Flame, Pencil, Plus, Loader2 } from "lucide-react"
import { RoutineBlocks } from "@/components/shared/routine-blocks/RoutineBlocks"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getTodayRoutineForMember } from "@/lib/actions/routines"
import { getTodayWodLog } from "@/lib/actions/wod-logs"
import { formatScore } from "@/lib/constants/wod-score"
import { LogWodModal } from "./log-wod-modal"

export function TodayWodHeader() {
  const [modalOpen, setModalOpen] = useState(false)

  const { data: routineToday, isLoading: lr } = useQuery({
    queryKey: ["portal-today-routine"],
    queryFn: getTodayRoutineForMember,
    staleTime: 5 * 60 * 1000,
  })

  const { data: log = null, isLoading: ll } = useQuery({
    queryKey: ["today-wod-log"],
    queryFn: getTodayWodLog,
    staleTime: 60 * 1000,
  })

  if (lr || ll) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!routineToday) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No tienes un plan asignado.
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Flame className="h-5 w-5 text-primary" />
            <div className="min-w-0">
              <CardTitle className="text-base">
                {routineToday.routine ? routineToday.routine.name : "Sin rutina asignada hoy"}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {routineToday.day_of_week}{routineToday.plan_name ? ` · ${routineToday.plan_name}` : ""}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {routineToday.routine ? (
            <RoutineBlocks
              blocks={(routineToday.routine as { blocks: unknown }).blocks}
              emptyMessage="Tu coach aún no completó esta rutina."
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Tu coach aún no asignó la rutina de hoy.
            </p>
          )}

          {routineToday.routine && (
            <div className="border-t pt-4">
              {log ? (
                <div className="flex items-center justify-between gap-3 rounded-md bg-primary/5 p-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Tu score</p>
                    <p className="font-bold text-lg tabular-nums">
                      {formatScore({
                        score_type: log.score_type,
                        score_seconds: log.score_seconds,
                        score_rounds: log.score_rounds,
                        score_reps: log.score_reps,
                        score_kg: log.score_kg,
                      })}
                    </p>
                  </div>
                  <Badge variant={log.rx ? "default" : "outline"} className="shrink-0">
                    {log.rx ? "RX" : "Scaled"}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => setModalOpen(true)} className="gap-2 shrink-0">
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => setModalOpen(true)} className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Registrar mi WOD
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <LogWodModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        existingLog={log}
        defaultRoutineId={routineToday.routine?.id}
      />
    </>
  )
}
