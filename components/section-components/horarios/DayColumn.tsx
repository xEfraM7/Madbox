"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ScheduleInline } from "./ScheduleInline"
import { RoutineCard } from "./RoutineCard"

interface DayColumnProps {
  scheduleRow: {
    id: string
    day_of_week: string
    open_time: string | null
    close_time: string | null
  }
  plans: Array<{ id: string; name: string }>
  routinesLibrary: Array<{ id: string; name: string }>
  assignmentsByPlan: Record<string, { id: string; name: string; content: string }>
  isToday: boolean
}

export function DayColumn({ scheduleRow, plans, routinesLibrary, assignmentsByPlan, isToday }: DayColumnProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-card p-3 gap-3 min-w-0",
        isToday && "border-primary/60 ring-2 ring-primary/30"
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide">{scheduleRow.day_of_week}</h3>
          {isToday && <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">HOY</Badge>}
        </div>
        <ScheduleInline
          id={scheduleRow.id}
          open_time={scheduleRow.open_time}
          close_time={scheduleRow.close_time}
        />
      </div>

      <div className="border-t -mx-3" />

      <div className="space-y-2">
        {plans.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Sin planes activos</p>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className="space-y-1">
              <p className="text-[10px] font-medium uppercase text-muted-foreground tracking-wide truncate">{plan.name}</p>
              <RoutineCard
                planId={plan.id}
                planName={plan.name}
                dayOfWeek={scheduleRow.day_of_week}
                routine={assignmentsByPlan[plan.id] ?? null}
                routinesLibrary={routinesLibrary}
                highlight={isToday}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
