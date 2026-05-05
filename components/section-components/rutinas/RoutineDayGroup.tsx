"use client"

import { format, isToday, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { RoutineCard } from "./RoutineCard"
import type { RoutineSchedule } from "@/lib/actions/routines"

interface Props {
  date: string
  routines: RoutineSchedule[]
}

export function RoutineDayGroup({ date, routines }: Props) {
  const d = parseISO(date + "T00:00:00")
  const label = format(d, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
  const labelCapitalized = label.charAt(0).toUpperCase() + label.slice(1)

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2 border-b pb-2">
        <h3 className="text-base font-semibold">{labelCapitalized}</h3>
        {isToday(d) && (
          <Badge variant="default" className="text-xs">
            Hoy
          </Badge>
        )}
      </div>
      <div className="space-y-2">
        {routines.map((r) => (
          <RoutineCard key={r.id} routine={r} />
        ))}
      </div>
    </section>
  )
}
