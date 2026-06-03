"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { startOfMonth, endOfMonth, addMonths, subMonths, format } from "date-fns"
import { getMemberRoutineDatesInRange, getRoutineForMemberOnDate } from "@/lib/actions/routines"
import { RutinaCalendar } from "./RutinaCalendar"
import { RutinaViewer } from "./RutinaViewer"
import { EntrenarTabs } from "../EntrenarTabs"

function todayCaracasISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return fmt.format(new Date())
}

export default function PortalRutinasMainComponent() {
  const [selectedDate, setSelectedDate] = useState<string>(todayCaracasISO())
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date())

  const range = useMemo(() => {
    const from = format(startOfMonth(subMonths(visibleMonth, 1)), "yyyy-MM-dd")
    const to = format(endOfMonth(addMonths(visibleMonth, 1)), "yyyy-MM-dd")
    return { from, to }
  }, [visibleMonth])

  const { data: routineDates = [] } = useQuery({
    queryKey: ["member-routine-dates", range],
    queryFn: () => getMemberRoutineDatesInRange(range.from, range.to),
  })

  const { data: routine, isLoading } = useQuery({
    queryKey: ["member-routine", selectedDate],
    queryFn: () => getRoutineForMemberOnDate(selectedDate),
  })

  return (
    <div className="space-y-4">
      <EntrenarTabs />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mis rutinas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecciona una fecha para ver la rutina programada.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(300px,360px)_1fr]">
        <RutinaCalendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          routineDates={routineDates}
          onMonthChange={setVisibleMonth}
        />
        <RutinaViewer date={selectedDate} routine={routine ?? null} isLoading={isLoading} />
      </div>
    </div>
  )
}
