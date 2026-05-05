"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import type { RoutineSchedule } from "@/lib/actions/routines"

interface Props {
  date: string
  routine: RoutineSchedule | null
  isLoading: boolean
}

export function RutinaViewer({ date, routine, isLoading }: Props) {
  const label = (() => {
    const l = format(parseISO(date + "T00:00:00"), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
    return l.charAt(0).toUpperCase() + l.slice(1)
  })()

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-4 min-h-[24rem]">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Rutina del día</p>
        <h2 className="text-xl font-semibold mt-1">{label}</h2>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : routine ? (
        <div className="space-y-3">
          {routine.name && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{routine.name}</Badge>
            </div>
          )}
          <article className="prose prose-invert prose-sm sm:prose-base max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{routine.content}</ReactMarkdown>
          </article>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">No hay rutina programada para esta fecha.</p>
        </div>
      )}
    </div>
  )
}
