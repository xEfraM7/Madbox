"use client"

import { useQuery } from "@tanstack/react-query"
import { Users, Clock, DollarSign, Loader2, CheckCircle2, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getActiveSpecialClasses, getMyEnrolledClasses } from "@/lib/actions/portal"

export default function PortalClasesMainComponent() {
  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ["portal-special-classes"],
    queryFn: getActiveSpecialClasses,
    staleTime: 5 * 60 * 1000,
  })

  const { data: enrolled = [], isLoading: loadingEnrolled } = useQuery({
    queryKey: ["my-enrolled-classes"],
    queryFn: getMyEnrolledClasses,
    staleTime: 5 * 60 * 1000,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrolledClassIds = new Set(enrolled.map((e: any) => e.class_id).filter(Boolean))

  if (loadingClasses || loadingEnrolled) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Clases Especiales</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Clases disponibles en el gimnasio
          </p>
        </div>
        {enrolled.length > 0 && (
          <Badge className="bg-primary/20 text-primary border-primary/40 gap-1 text-xs">
            <CheckCircle2 className="h-3 w-3" />
            {enrolled.length} inscrito{enrolled.length === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Calendar className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No hay clases disponibles por el momento.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {classes.map((cls: any) => {
            const isEnrolled = enrolledClassIds.has(cls.id)
            const spotsLeft = cls.capacity - (cls.enrolled ?? 0)
            const isFull = spotsLeft <= 0

            return (
              <Card
                key={cls.id}
                className={cn(
                  "transition-colors",
                  isEnrolled ? "border-primary/40" : "hover:border-primary/30",
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm sm:text-base truncate">{cls.name}</CardTitle>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                        {cls.instructor}
                      </p>
                    </div>
                    {isEnrolled && (
                      <Badge className="bg-primary/20 text-primary border-primary/40 shrink-0 gap-1 text-[10px] sm:text-xs">
                        <CheckCircle2 className="h-3 w-3" />
                        Inscrito
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                      <span className="truncate">{cls.schedule}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                      ${cls.price}
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1.5",
                        isFull && "text-red-400",
                      )}
                    >
                      <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                      {isFull ? "Sin cupos" : `${spotsLeft} cupo${spotsLeft === 1 ? "" : "s"}`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
