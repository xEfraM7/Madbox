"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { ArrowRight, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getRoutineForMemberOnDate } from "@/lib/actions/routines"

function todayCaracasISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return fmt.format(new Date())
}

export function TodayRoutineCard() {
  const today = todayCaracasISO()

  const { data: routine, isLoading } = useQuery({
    queryKey: ["my-routine", today],
    queryFn: () => getRoutineForMemberOnDate(today),
  })

  const dateLabel = (() => {
    const lbl = format(parseISO(today + "T00:00:00"), "EEEE, d 'de' MMMM", { locale: es })
    return lbl.charAt(0).toUpperCase() + lbl.slice(1)
  })()

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tu rutina de hoy</p>
          <h3 className="text-lg font-semibold mt-0.5">{dateLabel}</h3>
        </div>
        <Link href="/portal/rutinas">
          <Button variant="ghost" size="sm" className="gap-1">
            <CalendarDays className="h-4 w-4" /> Ver todas
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : routine ? (
        <div className="space-y-2">
          {routine.name && <p className="font-medium">{routine.name}</p>}
          <article className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{routine.content}</ReactMarkdown>
          </article>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Sin rutina programada para hoy.
          </p>
          <Link href="/portal/rutinas" className="inline-flex items-center gap-1 mt-2 text-sm text-primary hover:underline">
            Ver próximas rutinas <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  )
}
