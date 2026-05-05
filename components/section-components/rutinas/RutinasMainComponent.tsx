"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { format, addDays } from "date-fns"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermissions } from "@/lib/hooks/use-permissions"
import { getRoutineSchedules } from "@/lib/actions/routines"
import { RoutinesList } from "./RoutinesList"
import { RoutineWizardModal } from "./modals/routine-wizard-modal"

export default function RutinasMainComponent() {
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission("routines.edit")

  const [createOpen, setCreateOpen] = useState(false)

  const range = useMemo(() => {
    const today = new Date()
    return {
      from: format(today, "yyyy-MM-dd"),
      to: format(addDays(today, 60), "yyyy-MM-dd"),
    }
  }, [])

  const { data: routines = [], isLoading } = useQuery({
    queryKey: ["routine-schedules", range],
    queryFn: () => getRoutineSchedules(range),
  })

  return (
    <DashboardLayout>
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Rutinas</h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1.5">
              Programa rutinas por fecha y plan.
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => setCreateOpen(true)} className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Crear rutina
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : (
          <RoutinesList routines={routines} />
        )}
      </div>

      <RoutineWizardModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />
    </DashboardLayout>
  )
}
