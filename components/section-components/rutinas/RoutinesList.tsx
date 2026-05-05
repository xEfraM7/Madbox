"use client"

import { useMemo } from "react"
import { CalendarDays } from "lucide-react"
import type { RoutineSchedule } from "@/lib/actions/routines"
import { RoutineDayGroup } from "./RoutineDayGroup"

interface Props {
  routines: RoutineSchedule[]
}

export function RoutinesList({ routines }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, RoutineSchedule[]>()
    for (const r of routines) {
      if (!map.has(r.date)) map.set(r.date, [])
      map.get(r.date)!.push(r)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [routines])

  if (grouped.length === 0) {
    return (
      <div className="border border-dashed rounded-lg p-10 text-center space-y-3">
        <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">No hay rutinas programadas</p>
          <p className="text-xs text-muted-foreground">
            Pulsa <strong>+ Crear rutina</strong> para programar la primera.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {grouped.map(([date, items]) => (
        <RoutineDayGroup key={date} date={date} routines={items} />
      ))}
    </div>
  )
}
