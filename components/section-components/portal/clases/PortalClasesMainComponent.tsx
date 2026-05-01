"use client"

import { useQuery } from "@tanstack/react-query"
import { Users, Clock, DollarSign, Loader2, CheckCircle2 } from "lucide-react"
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clases Especiales</h1>
        <p className="text-muted-foreground text-sm mt-1">Clases disponibles en el gimnasio</p>
      </div>

      {classes.length === 0 && (
        <p className="text-muted-foreground text-center py-10">
          No hay clases disponibles por el momento.
        </p>
      )}

      <div className="grid gap-4">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {classes.map((cls: any) => {
          const isEnrolled = enrolledClassIds.has(cls.id)
          const spotsLeft = cls.capacity - (cls.enrolled ?? 0)

          return (
            <Card key={cls.id} className={cn(isEnrolled && "border-primary/40")}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{cls.name}</CardTitle>
                  {isEnrolled && (
                    <Badge className="bg-primary/20 text-primary border-primary/40 shrink-0 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Inscrito
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{cls.instructor}</p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {cls.schedule}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    ${cls.price}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {spotsLeft > 0 ? `${spotsLeft} cupos disponibles` : "Sin cupos"}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
