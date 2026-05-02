"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Save } from "lucide-react"
import { showToast } from "@/lib/sweetalert"
import { createRoutine, updateRoutine } from "@/lib/actions/routines"

interface FormData {
  name: string
  content: string
}

interface RoutineFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routine?: { id: string; name: string; content: string } | null
}

export function RoutineFormModal({ open, onOpenChange, routine }: RoutineFormModalProps) {
  const queryClient = useQueryClient()
  const isEdit = !!routine

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { name: "", content: "" },
  })

  const contentValue = watch("content")

  useEffect(() => {
    if (open) {
      reset({
        name: routine?.name ?? "",
        content: routine?.content ?? "",
      })
    }
  }, [open, routine, reset])

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (isEdit && routine) {
        return updateRoutine(routine.id, { name: data.name.trim(), content: data.content })
      }
      return createRoutine({ name: data.name.trim(), content: data.content })
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

  const onSubmit = (data: FormData) => {
    if (!data.name.trim()) {
      showToast.error("Falta el nombre", "La rutina necesita un nombre.")
      return
    }
    mutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar rutina" : "Nueva rutina"}</DialogTitle>
          <DialogDescription>
            Usa Markdown para dar formato (encabezados con #, listas con - o *, negritas con **).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              placeholder="Ej: Metabólico Lunes A"
              {...register("name", { required: true })}
            />
            {errors.name && <p className="text-xs text-destructive">El nombre es requerido</p>}
          </div>

          <Tabs defaultValue="edit" className="w-full">
            <TabsList>
              <TabsTrigger value="edit">Editar</TabsTrigger>
              <TabsTrigger value="preview">Vista previa</TabsTrigger>
            </TabsList>
            <TabsContent value="edit">
              <Textarea
                id="content"
                rows={14}
                placeholder={`Metabólico condition\n\nAmrap 7'\n- 10 dead lift 100 kg\n- 6 bar muscle up\n\nRest 2'\n...`}
                className="font-mono text-sm"
                {...register("content")}
              />
            </TabsContent>
            <TabsContent value="preview">
              <div className="prose prose-invert prose-sm max-w-none border rounded-md p-4 min-h-[280px] bg-muted/30">
                {contentValue?.trim() ? (
                  <ReactMarkdown>{contentValue}</ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground text-sm m-0">Sin contenido aún.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="gap-2">
              {mutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
              ) : (
                <><Save className="h-4 w-4" /> {isEdit ? "Guardar cambios" : "Crear rutina"}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
