"use client"

import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Save, Trash2 } from "lucide-react"
import { upsertRoutineAssignment, deleteRoutineAssignment } from "@/lib/actions/routines"
import { usePermissions } from "@/lib/hooks/use-permissions"

interface RoutineAssignModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  planName: string
  dayOfWeek: string
  currentRoutineId: string | null
  routines: Array<{ id: string; name: string }>
}

export function RoutineAssignModal({
  open, onOpenChange, planId, planName, dayOfWeek, currentRoutineId, routines,
}: RoutineAssignModalProps) {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const canDelete = hasPermission("schedule.delete")

  const [selectedId, setSelectedId] = useState<string>(currentRoutineId ?? "")

  useEffect(() => {
    if (open) setSelectedId(currentRoutineId ?? "")
  }, [open, currentRoutineId])

  const upsertMutation = useMutation({
    mutationFn: (routine_id: string) =>
      upsertRoutineAssignment({ plan_id: planId, day_of_week: dayOfWeek, routine_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routine-assignments"] })
      queryClient.invalidateQueries({ queryKey: ["routines"] })
      showToast.success("Rutina asignada", `${planName} · ${dayOfWeek} actualizado.`)
      onOpenChange(false)
    },
    onError: (e: Error) => showToast.error("Error", e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteRoutineAssignment({ plan_id: planId, day_of_week: dayOfWeek }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routine-assignments"] })
      queryClient.invalidateQueries({ queryKey: ["routines"] })
      showToast.success("Rutina quitada", `${planName} · ${dayOfWeek} sin asignar.`)
      onOpenChange(false)
    },
    onError: (e: Error) => showToast.error("Error", e.message),
  })

  const handleSave = () => {
    if (!selectedId) {
      showToast.error("Selecciona una rutina", "Elige una rutina o pulsa Quitar.")
      return
    }
    upsertMutation.mutate(selectedId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar rutina</DialogTitle>
          <DialogDescription>
            {planName} · {dayOfWeek}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Rutina</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder={routines.length === 0 ? "No hay rutinas en la biblioteca" : "Selecciona una rutina"} />
              </SelectTrigger>
              <SelectContent>
                {routines.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {routines.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Crea una rutina primero desde la Biblioteca.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          {currentRoutineId && canDelete && (
            <Button
              variant="ghost"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="gap-2 mr-auto text-destructive hover:text-destructive"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Quitar asignación
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsertMutation.isPending} className="gap-2">
            {upsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
