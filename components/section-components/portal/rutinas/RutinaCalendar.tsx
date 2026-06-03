"use client"

import { useMemo } from "react"
import { parseISO, format } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"

interface Props {
  selectedDate: string
  onSelectDate: (date: string) => void
  routineDates: string[]
  onMonthChange?: (month: Date) => void
}

export function RutinaCalendar({ selectedDate, onSelectDate, routineDates, onMonthChange }: Props) {
  const selected = useMemo(() => parseISO(selectedDate + "T00:00:00"), [selectedDate])
  const markers = useMemo(
    () => routineDates.map((d) => parseISO(d + "T00:00:00")),
    [routineDates],
  )

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Calendar
        mode="single"
        locale={es}
        selected={selected}
        onSelect={(d) => {
          if (!d) return
          onSelectDate(format(d, "yyyy-MM-dd"))
        }}
        onMonthChange={onMonthChange}
        showOutsideDays
        className="w-full bg-transparent p-3 sm:p-4 [--cell-size:2.5rem] sm:[--cell-size:2.75rem]"
        classNames={{ root: "w-full" }}
        modifiers={{ hasRoutine: markers }}
        modifiersClassNames={{
          hasRoutine:
            "relative after:content-[''] after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary data-[selected=true]:after:bg-primary-foreground",
        }}
      />
    </div>
  )
}
