"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createMember, updateMember } from "@/lib/actions/members"
import { getPlans } from "@/lib/actions/plans"

interface FormData {
  name: string
  email: string
  phone: string
  plan_id: string
  payment_date: string
}

interface UserFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: any
}

export function UserFormModal({ open, onOpenChange, user }: UserFormModalProps) {
  const queryClient = useQueryClient()
  
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { name: "", email: "", phone: "", plan_id: "", payment_date: "" }
  })

  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    enabled: open,
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) => createMember(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["members"] })
      toast.success("Cliente creado", { description: `${variables.name} ha sido registrado correctamente.` })
      onOpenChange(false)
    },
    onError: () => toast.error("Error", { description: "No se pudo crear el cliente." }),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => updateMember(user.id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["members"] })
      toast.success("Cliente actualizado", { description: `${variables.name} ha sido actualizado correctamente.` })
      onOpenChange(false)
    },
    onError: () => toast.error("Error", { description: "No se pudo actualizar el cliente." }),
  })

  useEffect(() => {
    if (open) {
      if (user) {
        reset({ name: user.name || "", email: user.email || "", phone: user.phone || "", plan_id: user.plan_id || "", payment_date: user.payment_date || "" })
      } else {
        const nextMonth = new Date()
        nextMonth.setDate(nextMonth.getDate() + 30)
        reset({ name: "", email: "", phone: "", plan_id: "", payment_date: nextMonth.toISOString().split("T")[0] })
      }
    }
  }, [user, open, reset])

  const onSubmit = (data: FormData) => {
    if (user) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const planId = watch("plan_id")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{user ? "Editar Cliente" : "Agregar Nuevo Cliente"}</DialogTitle>
          <DialogDescription>{user ? "Modifica la información del cliente" : "Completa el formulario para registrar un nuevo cliente"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input id="name" {...register("name", { required: "El nombre es requerido" })} placeholder="Ej: Juan Pérez" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" type="email" {...register("email", { required: "El correo es requerido", pattern: { value: /^\S+@\S+$/i, message: "Correo inválido" } })} placeholder="correo@ejemplo.com" />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" type="tel" {...register("phone")} placeholder="+34 600 000 000" />
            </div>
            <div className="grid gap-2">
              <Label>Plan</Label>
              <Select value={planId} onValueChange={(value) => setValue("plan_id", value)}>
                <SelectTrigger><SelectValue placeholder="Selecciona un plan" /></SelectTrigger>
                <SelectContent>
                  {plans.filter((p: any) => p.active).map((plan: any) => (
                    <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment_date">Fecha de pago</Label>
              <Input id="payment_date" type="date" {...register("payment_date", { required: "La fecha de pago es requerida" })} />
              {errors.payment_date && <p className="text-sm text-destructive">{errors.payment_date.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Guardando..." : user ? "Guardar cambios" : "Crear cliente"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
