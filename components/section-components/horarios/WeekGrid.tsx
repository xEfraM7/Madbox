"use client"

import { useMemo } from "react"
import { DayColumn } from "./DayColumn"

const DAY_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

const DAY_MAP: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
}

function getTodayLabel(): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    weekday: "long",
  })
  return DAY_MAP[formatter.format(new Date()).toLowerCase()] ?? "Lunes"
}

interface ScheduleRow {
  id: string
  day_of_week: string
  open_time: string | null
  close_time: string | null
}

interface AssignmentRow {
  id: string
  plan_id: string
  day_of_week: string
  routine_id: string
  routines: { id: string; name: string; content: string } | null
}

interface WeekGridProps {
  schedule: ScheduleRow[]
  plans: Array<{ id: string; name: string }>
  routines: Array<{ id: string; name: string }>
  assignments: AssignmentRow[]
}

export function WeekGrid({ schedule, plans, routines, assignments }: WeekGridProps) {
  const today = useMemo(getTodayLabel, [])

  const sortedSchedule = useMemo(
    () => [...schedule].sort((a, b) => DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week)),
    [schedule],
  )

  const assignmentIndex = useMemo(() => {
    const idx: Record<string, Record<string, { id: string; name: string; content: string }>> = {}
    for (const a of assignments) {
      if (!a.routines) continue
      idx[a.day_of_week] ??= {}
      idx[a.day_of_week][a.plan_id] = a.routines
    }
    return idx
  }, [assignments])

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-7">
      {sortedSchedule.map((row) => (
        <DayColumn
          key={row.id}
          scheduleRow={row}
          plans={plans}
          routinesLibrary={routines}
          assignmentsByPlan={assignmentIndex[row.day_of_week] ?? {}}
          isToday={row.day_of_week === today}
        />
      ))}
    </div>
  )
}
