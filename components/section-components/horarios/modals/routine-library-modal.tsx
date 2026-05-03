"use client"

import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Edit, Trash2, Eye, Copy, BookOpen } from "lucide-react"
import { createRoutine, deleteRoutine } from "@/lib/actions/routines"
import { usePermissions } from "@/lib/hooks/use-permissions"
import { RoutineFormModal } from "./routine-form-modal"
import { RoutinePreviewModal } from "./routine-preview-modal"

interface RoutineLibraryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routines: Array<{
    id: string
    name: string
    content: string
    blocks: unknown
    routine_assignments: Array<{ count: number }> | { count: number }[]
  }>
}

export function RoutineLibraryModal({ open, onOpenChange, routines }: RoutineLibraryModalProps) {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission("schedule.edit")
  const canDelete = hasPermission("schedule.delete")

  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<{ id: string; name: string; blocks: unknown } | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewing, setPreviewing] = useState<{ name: string; blocks: unknown } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; usage: number } | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return routines
    const q = search.toLowerCase()
    return routines.filter(r => r.name.toLowerCase().includes(q))
  }, [routines, search])

  const duplicateMutation = useMutation({
    mutationFn: (r: { name: string; blocks: unknown }) =>
      createRoutine({ name: `${r.name} (copia)`, blocks: r.blocks as never }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] })
      showToast.success("Rutina duplicada", "Se creó una copia.")
    },
    onError: (e: Error) => showToast.error("Error", e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRoutine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] })
      queryClient.invalidateQueries({ queryKey: ["routine-assignments"] })
      showToast.success("Rutina eliminada", "Se eliminó y se quitaron sus asignaciones.")
    },
    onError: (e: Error) => showToast.error("Error", e.message),
  })

  const handleDelete = (r: { id: string; name: string; routine_assignments: Array<{ count: number }> }) => {
    const usage = Array.isArray(r.routine_assignments)
      ? r.routine_assignments[0]?.count ?? 0
      : 0
    setDeleteTarget({ id: r.id, name: r.name, usage })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Biblioteca de Rutinas
            </DialogTitle>
            <DialogDescription>
              Crea, edita y reutiliza rutinas. Una misma rutina puede asignarse a varios planes y días.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar rutina..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {canEdit && (
              <Button
                onClick={() => { setEditing(null); setFormOpen(true) }}
                className="gap-2 shrink-0"
              >
                <Plus className="h-4 w-4" /> Nueva
              </Button>
            )}
          </div>

          <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {routines.length === 0 ? "Aún no hay rutinas. Crea la primera." : "Sin resultados."}
              </p>
            ) : (
              filtered.map((r) => {
                const usage = Array.isArray(r.routine_assignments)
                  ? r.routine_assignments[0]?.count ?? 0
                  : 0
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {usage === 0 ? "Sin asignar" : `${usage} asignación(es)`}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { setPreviewing(r); setPreviewOpen(true) }}
                      title="Ver rutina"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => duplicateMutation.mutate(r)}
                        title="Duplicar"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { setEditing({ id: r.id, name: r.name, blocks: r.blocks }); setFormOpen(true) }}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(r)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RoutineFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        routine={editing}
      />
      <RoutinePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        routine={previewing}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="¿Eliminar rutina?"
        description={
          deleteTarget
            ? deleteTarget.usage > 0
              ? `"${deleteTarget.name}" está asignada en ${deleteTarget.usage} día(s). Se eliminará junto con sus asignaciones.`
              : `Eliminar "${deleteTarget.name}" permanentemente.`
            : ""
        }
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id)
            setDeleteTarget(null)
          }
        }}
      />
    </>
  )
}
