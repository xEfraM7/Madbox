"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"
import { createPlan, updatePlan } from "@/lib/actions/plans"

interface PlanFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan?: any
}

interface FormData {
  name: string
  price: string
  duration: string
  features: string
  active: boolean
}

export function PlanFormModal({ open, onOpenChange, plan }: PlanFormModalProps) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { name: "", price: "", duration: "Mensual", features: "", active: true }
  })

  const active = watch("active")

  useEffect(() => {
    if (open) {
      if (plan) {
        reset({
          name: plan.name || "",
          price: plan.price?.toString() || "",
          duration: plan.duration || "Mensual",
          features: plan.features?.join("\n") || "",
          active: plan.active ?? true
        })
      } else {
        reset({ name: "", price: "", duration: "Mensual", features: "", active: true })
      }
    }
  }, [plan, open, reset])

  const createMutation = useMutation({
    mutationFn: (data: any) => createPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] })
      showToast.success("Plan creado", "El plan ha sido creado correctamente." )
      onOpenChange(false)
    },
    onError: () => {
      showToast.error("Error", "No se pudo crear el plan." )
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => updatePlan(plan.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] })
      showToast.success("Plan actualizado", "Los cambios han sido guardados." )
      onOpenChange(false)
    },
    onError: () => {
      showToast.error("Error", "No se pudo actualizar el plan." )
    },
  })

  const onSubmit = (data: FormData) => {
    const planData = {
      name: data.name,
      price: parseFloat(data.price),
      duration: "Mensual",
      features: data.features.split("\n").filter(f => f.trim()),
      active: data.active
    }

    if (plan) {
      updateMutation.mutate(planData)
    } else {
      createMutation.mutate(planData)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{plan ? "Editar Plan" : "Crear Nuevo Plan"}</DialogTitle>
          <DialogDescription>{plan ? "Modifica los detalles del plan" : "Define un nuevo plan de mensualidad"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre del plan</Label>
              <Input 
                id="name" 
                {...register("name", { required: "El nombre es requerido" })} 
                placeholder="Ej: Plan Premium" 
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price">Precio mensual</Label>
              <Input 
                id="price" 
                type="number" 
                step="0.01" 
                {...register("price", { required: "El precio es requerido", min: { value: 0, message: "El precio debe ser positivo" } })} 
                placeholder="29.99" 
              />
              {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="features">Características (una por línea)</Label>
              <Textarea 
                id="features" 
                {...register("features")} 
                placeholder="Acceso al gimnasio&#10;Clases grupales&#10;Asesoría nutricional" 
                rows={5} 
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Plan activo</Label>
              <Switch id="active" checked={active} onCheckedChange={(checked) => setValue("active", checked)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : plan ? "Guardar cambios" : "Crear plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
