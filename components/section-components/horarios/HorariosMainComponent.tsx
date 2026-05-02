"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Loader2, Library } from "lucide-react"
import { getGymSchedule } from "@/lib/actions/settings"
import { getRoutines, getRoutineAssignments } from "@/lib/actions/routines"
import { getPlans } from "@/lib/actions/plans"
import { RoutineLibraryModal } from "./modals/routine-library-modal"
import { WeekGrid } from "./WeekGrid"

export default function HorariosMainComponent() {
  const [libraryOpen, setLibraryOpen] = useState(false)

  const { data: schedule = [], isLoading: loadingSchedule } = useQuery({
    queryKey: ["gym-schedule"],
    queryFn: getGymSchedule,
  })

  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
  })

  const { data: routines = [], isLoading: loadingRoutines } = useQuery({
    queryKey: ["routines"],
    queryFn: getRoutines,
  })

  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ["routine-assignments"],
    queryFn: getRoutineAssignments,
  })

  const isLoading = loadingSchedule || loadingPlans || loadingRoutines || loadingAssignments

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  const activePlans = plans.filter((p: any) => p.active !== false)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-balance">Horarios y Rutinas</h1>
            <p className="text-muted-foreground mt-2">
              Define el horario del gym y las rutinas por día y plan
            </p>
          </div>
          <Button onClick={() => setLibraryOpen(true)} className="gap-2">
            <Library className="h-4 w-4" />
            Biblioteca de Rutinas
          </Button>
        </div>

        {activePlans.length === 0 ? (
          <div className="border border-dashed rounded-lg p-8 text-center space-y-2">
            <p className="text-sm font-medium">No hay planes activos</p>
            <p className="text-xs text-muted-foreground">
              Crea o activa un plan en{" "}
              <a href="/dashboard/plans" className="text-primary hover:underline">/dashboard/plans</a>{" "}
              antes de asignar rutinas.
            </p>
          </div>
        ) : (
          <WeekGrid
            schedule={schedule as any}
            plans={activePlans.map((p: any) => ({ id: p.id, name: p.name }))}
            routines={routines.map((r: any) => ({ id: r.id, name: r.name }))}
            assignments={assignments as any}
          />
        )}
      </div>
      <RoutineLibraryModal
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        routines={routines as any}
      />
    </DashboardLayout>
  )
}
