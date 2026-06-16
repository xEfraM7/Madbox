"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"
import { createCategory, updateCategory } from "@/lib/actions/products"

interface CategoryFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: any
}

interface FormData {
  name: string
  sort_order: string
  active: boolean
}

export function CategoryFormModal({ open, onOpenChange, category }: CategoryFormModalProps) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { name: "", sort_order: "0", active: true }
  })
  const active = watch("active")

  useEffect(() => {
    if (open) {
      if (category) {
        reset({ name: category.name || "", sort_order: category.sort_order?.toString() || "0", active: category.active ?? true })
      } else {
        reset({ name: "", sort_order: "0", active: true })
      }
    }
  }, [category, open, reset])

  const createMutation = useMutation({
    mutationFn: (data: any) => createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] })
      showToast.success("Categoría creada", "La categoría ha sido creada.")
      onOpenChange(false)
    },
    onError: () => showToast.error("Error", "No se pudo crear la categoría."),
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateCategory(category.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] })
      showToast.success("Categoría actualizada", "Los cambios han sido guardados.")
      onOpenChange(false)
    },
    onError: () => showToast.error("Error", "No se pudo actualizar la categoría."),
  })

  const onSubmit = (data: FormData) => {
    const payload = { name: data.name, sort_order: parseInt(data.sort_order, 10) || 0, active: data.active }
    if (category) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          <DialogDescription>{category ? "Modifica la categoría" : "Crea una categoría de productos"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cat-name">Nombre</Label>
              <Input id="cat-name" {...register("name", { required: "El nombre es requerido" })} placeholder="Ej: Suplementos" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cat-order">Orden</Label>
              <Input id="cat-order" type="number" {...register("sort_order")} placeholder="0" />
              <p className="text-xs text-muted-foreground">Define la posición en el catálogo. Menor número aparece primero.</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <div>
                <Label htmlFor="cat-active" className="cursor-pointer">Activa</Label>
                <p className="text-xs text-muted-foreground">Disponible para asignar a productos</p>
              </div>
              <Switch id="cat-active" checked={active} onCheckedChange={(c) => setValue("active", c)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : category ? "Guardar cambios" : "Crear categoría"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
