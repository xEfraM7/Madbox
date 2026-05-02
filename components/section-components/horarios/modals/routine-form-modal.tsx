"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Save } from "lucide-react"
import { showToast } from "@/lib/sweetalert"
import { createRoutine, updateRoutine } from "@/lib/actions/routines"
import {
  type RoutineBlock,
  parseBlocks,
} from "@/lib/constants/routine-blocks"
import { RoutineBlockEditor } from "./RoutineBlockEditor"
import { RoutineBlocks } from "@/components/shared/routine-blocks/RoutineBlocks"

interface RoutineFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routine?: { id: string; name: string; blocks: unknown } | null
}

export function RoutineFormModal({ open, onOpenChange, routine }: RoutineFormModalProps) {
  const queryClient = useQueryClient()
  const isEdit = !!routine

  const [name, setName] = useState("")
  const [blocks, setBlocks] = useState<RoutineBlock[]>([])

  useEffect(() => {
    if (open) {
      setName(routine?.name ?? "")
      setBlocks(parseBlocks(routine?.blocks))
    }
  }, [open, routine])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("La rutina necesita un nombre")
      if (isEdit && routine) {
        return updateRoutine(routine.id, { name: name.trim(), blocks: blocks as never })
      }
      return createRoutine({ name: name.trim(), blocks: blocks as never })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] })
      queryClient.invalidateQueries({ queryKey: ["routine-assignments"] })
      showToast.success(isEdit ? "Rutina actualizada" : "Rutina creada", "Los cambios se guardaron correctamente.")
      onOpenChange(false)
    },
    onError: (e: Error) => {
      showToast.error("Error", e.message ?? "No se pudo guardar la rutina.")
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar rutina" : "Nueva rutina"}</DialogTitle>
          <DialogDescription>
            Define los bloques que componen la rutina (warm-up, strength, WOD, cool-down).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              placeholder="Ej: Metabólico Lunes A"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <Tabs defaultValue="edit" className="w-full">
            <TabsList>
              <TabsTrigger value="edit">Editar bloques</TabsTrigger>
              <TabsTrigger value="preview">Vista previa</TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="mt-3">
              <RoutineBlockEditor
                blocks={blocks}
                onChange={setBlocks}
                disabled={mutation.isPending}
              />
            </TabsContent>
            <TabsContent value="preview" className="mt-3">
              <div className="border rounded-md p-4 min-h-[200px] bg-muted/30">
                <RoutineBlocks blocks={blocks} emptyMessage="Sin bloques aún. Agrega el primero." />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="gap-2"
          >
            {mutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
            ) : (
              <><Save className="h-4 w-4" /> {isEdit ? "Guardar cambios" : "Crear rutina"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
