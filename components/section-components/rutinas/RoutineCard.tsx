"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Eye, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import Swal from "sweetalert2"
import { usePermissions } from "@/lib/hooks/use-permissions"
import { deleteRoutineSchedule, type RoutineSchedule } from "@/lib/actions/routines"
import { RoutinePreviewModal } from "./modals/routine-preview-modal"
import { RoutineWizardModal } from "./modals/routine-wizard-modal"

interface Props {
  routine: RoutineSchedule
}

function shortPreview(md: string, max = 120): string {
  const stripped = md
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/[#>*_~\-]/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return stripped.length > max ? stripped.slice(0, max) + "…" : stripped
}

export function RoutineCard({ routine }: Props) {
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission("routines.edit")
  const canDelete = hasPermission("routines.delete")

  const [previewOpen, setPreviewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const queryClient = useQueryClient()

  const deleteMut = useMutation({
    mutationFn: () => deleteRoutineSchedule(routine.id),
    onSuccess: () => {
      toast.success("Rutina eliminada")
      queryClient.invalidateQueries({ queryKey: ["routine-schedules"] })
    },
    onError: (e: Error) => toast.error(e.message ?? "Error al eliminar"),
  })

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: "¿Eliminar rutina?",
      text: `${routine.name ?? "Rutina"} · ${routine.date}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#374151",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      background: "#0a0a0a",
      color: "#fff",
    })
    if (result.isConfirmed) deleteMut.mutate()
  }

  return (
    <>
      <div className="rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <h4 className="font-semibold truncate">
              {routine.name?.trim() || <span className="text-muted-foreground italic">Rutina sin nombre</span>}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {routine.plans.map((p) => (
                <Badge key={p.id} variant="secondary" className="text-xs">
                  {p.name}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {shortPreview(routine.content) || <span className="italic">Sin contenido</span>}
            </p>
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <Button size="icon" variant="ghost" onClick={() => setPreviewOpen(true)} title="Ver rutina">
              <Eye className="h-4 w-4" />
            </Button>
            {canEdit && (
              <Button size="icon" variant="ghost" onClick={() => setEditOpen(true)} title="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                size="icon"
                variant="ghost"
                onClick={handleDelete}
                disabled={deleteMut.isPending}
                title="Eliminar"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <RoutinePreviewModal open={previewOpen} onOpenChange={setPreviewOpen} routine={routine} />
      <RoutineWizardModal
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        routine={routine}
      />
    </>
  )
}
