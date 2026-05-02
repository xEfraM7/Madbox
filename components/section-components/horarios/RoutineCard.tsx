"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { RoutineAssignModal } from "./modals/routine-assign-modal"
import { RoutinePreviewModal } from "./modals/routine-preview-modal"
import { usePermissions } from "@/lib/hooks/use-permissions"

interface RoutineCardProps {
  planId: string
  planName: string
  dayOfWeek: string
  routine: { id: string; name: string; content: string; blocks: unknown } | null
  routinesLibrary: Array<{ id: string; name: string }>
  highlight?: boolean
}

export function RoutineCard({ planId, planName, dayOfWeek, routine, routinesLibrary, highlight }: RoutineCardProps) {
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission("schedule.edit")

  const [assignOpen, setAssignOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <>
      <div
        className={cn(
          "group rounded-md border p-2 text-xs transition-colors",
          routine ? "bg-muted/30 hover:bg-muted/50" : "bg-background hover:bg-muted/20 border-dashed",
          highlight && "ring-1 ring-primary/40"
        )}
      >
        {routine ? (
          <div className="flex items-start gap-1">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="flex-1 min-w-0 text-left hover:underline"
              title="Ver rutina"
            >
              <p className="font-medium truncate">{routine.name}</p>
            </button>
            {canEdit ? (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setAssignOpen(true)}
                className="h-6 w-6 shrink-0 opacity-60 group-hover:opacity-100"
                title="Cambiar asignación"
              >
                <Edit className="h-3 w-3" />
              </Button>
            ) : (
              <Eye className="h-3 w-3 mt-1 text-muted-foreground" />
            )}
          </div>
        ) : canEdit ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAssignOpen(true)}
            className="h-7 w-full justify-start gap-1 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Asignar
          </Button>
        ) : (
          <p className="text-muted-foreground text-center py-1">—</p>
        )}
      </div>

      <RoutineAssignModal
        open={assignOpen}
        onOpenChange={setAssignOpen}
        planId={planId}
        planName={planName}
        dayOfWeek={dayOfWeek}
        currentRoutineId={routine?.id ?? null}
        routines={routinesLibrary}
      />

      <RoutinePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        routine={routine}
        context={`${planName} · ${dayOfWeek}`}
      />
    </>
  )
}
