"use client"

import { useQuery } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import { CalendarDays, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getTodayRoutineForMember } from "@/lib/actions/routines"

export function TodayRoutineCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["portal-today-routine"],
    queryFn: getTodayRoutineForMember,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!data) return null // sin plan asignado

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div className="min-w-0">
            <CardTitle className="text-base">Rutina de hoy · {data.day_of_week}</CardTitle>
            {data.plan_name && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {data.plan_name}{data.routine ? ` · ${data.routine.name}` : ""}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.routine ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{data.routine.content || "_Sin contenido._"}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tu coach aún no asignó la rutina de hoy.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
