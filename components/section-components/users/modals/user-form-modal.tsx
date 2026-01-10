"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { DateInput } from "@/components/ui/date-input"
import { createMember, updateMember } from "@/lib/actions/members"
import { createPayment } from "@/lib/actions/payments"
import { getPlans } from "@/lib/actions/plans"
import { sendWelcomeEmail } from "@/lib/actions/email"

interface FormData {
  name: string
  email: string
  phone: string
  plan_id: string
}

interface UserFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: any
}

export function UserFormModal({ open, onOpenChange, user }: UserFormModalProps) {
  const queryClient = useQueryClient()
  const [registerFirstPayment, setRegisterFirstPayment] = useState(true)
  const [sendWelcome, setSendWelcome] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState("Efectivo")
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentReference, setPaymentReference] = useState("")
  const [paymentDate, setPaymentDate] = useState("")
  const [paymentRate, setPaymentRate] = useState("")

  const METHODS_IN_BS = ["Pago Movil", "Efectivo bs", "Transferencia BS"]

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: { name: "", email: "", phone: "", plan_id: "" },
  })

  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    enabled: open,
  })

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const today = new Date().toISOString().split("T")[0]
      const selectedPaymentDate = paymentDate || today
      // Calcular fecha de vencimiento: mismo día del mes siguiente
      const dueDate = new Date(selectedPaymentDate + "T00:00:00")
      dueDate.setMonth(dueDate.getMonth() + 1)
      // Ajustar si el día no existe en el mes siguiente
      const originalDay = new Date(selectedPaymentDate + "T00:00:00").getDate()
      if (dueDate.getDate() !== originalDay) {
        dueDate.setDate(0)
      }
      const dueDateStr = dueDate.toISOString().split("T")[0]

      const memberData = {
        ...data,
        payment_date: dueDateStr,
      }
      const member = await createMember(memberData)

      if (registerFirstPayment && member?.id && data.plan_id) {
        const selectedPlan = plans.find((p: any) => p.id === data.plan_id)
        const amount = paymentAmount ? parseFloat(paymentAmount) : selectedPlan?.price || 0
        if (amount > 0) {
          const methodsWithReference = ["Pago Movil", "Transferencia", "Transferencia BS", "USDT"]
          const methodsInBs = ["Pago Movil", "Efectivo bs", "Transferencia BS"]
          await createPayment({
            member_id: member.id,
            plan_id: data.plan_id,
            amount: amount,
            method: paymentMethod,
            reference: methodsWithReference.includes(paymentMethod) && paymentReference ? paymentReference : null,
            status: "paid",
            payment_date: selectedPaymentDate,
            due_date: dueDateStr,
            payment_rate: methodsInBs.includes(paymentMethod) && paymentRate ? parseFloat(paymentRate) : null,
          })
        }
      }

      if (sendWelcome && member?.id) {
        const selectedPlan = plans.find((p: any) => p.id === data.plan_id)
        sendWelcomeEmail({
          to: data.email,
          memberName: data.name,
          planName: selectedPlan?.name,
        }).catch(console.error)
      }

      return member
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["members"] })
      queryClient.invalidateQueries({ queryKey: ["payments"] })
      queryClient.invalidateQueries({ queryKey: ["payments-funds-summary"] })
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
      const message = registerFirstPayment
        ? `${variables.name} ha sido registrado con su primer pago.`
        : `${variables.name} ha sido registrado sin pago inicial.`
      showToast.success("Cliente creado", message)
      onOpenChange(false)
    },
    onError: () => showToast.error("Error", "No se pudo crear el cliente."),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => updateMember(user.id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["members"] })
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
      showToast.success("Cliente actualizado", `${variables.name} ha sido actualizado correctamente.`)
      onOpenChange(false)
    },
    onError: () => showToast.error("Error", "No se pudo actualizar el cliente."),
  })

  useEffect(() => {
    if (open) {
      if (user) {
        reset({ name: user.name || "", email: user.email || "", phone: user.phone || "", plan_id: user.plan_id || "" })
      } else {
        reset({ name: "", email: "", phone: "", plan_id: "" })
        setRegisterFirstPayment(true)
        setSendWelcome(true)
        setPaymentMethod("Efectivo")
        setPaymentAmount("")
        setPaymentReference("")
        setPaymentDate("")
        setPaymentRate("")
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
  const selectedPlan = plans.find((p: any) => p.id === planId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{user ? "Editar Cliente" : "Agregar Nuevo Cliente"}</DialogTitle>
          <DialogDescription>
            {user ? "Modifica la información del cliente" : "Completa el formulario para registrar un nuevo cliente"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="grid gap-4 py-4 overflow-y-auto flex-1 px-1">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input id="name" {...register("name", { required: "El nombre es requerido" })} placeholder="Ej: Juan Pérez" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                {...register("email", { required: "El correo es requerido", pattern: { value: /^\S+@\S+$/i, message: "Correo inválido" } })}
                placeholder="correo@ejemplo.com"
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" type="tel" {...register("phone")} placeholder="+58 412 000 0000" />
            </div>
            <div className="grid gap-2">
              <Label>Plan</Label>
              <Select value={planId} onValueChange={(value) => setValue("plan_id", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans
                    .filter((p: any) => p.active)
                    .map((plan: any) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - ${Number(plan.price).toFixed(2)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {!user && planId && (
              <>
                <div className="grid gap-2">
                  <Label>Fecha de inicio</Label>
                  <DateInput value={paymentDate} onChange={(value) => setPaymentDate(value)} placeholder="Selecciona fecha" />
                  <p className="text-xs text-muted-foreground">Por defecto es hoy. El vencimiento será el mismo día del mes siguiente.</p>
                </div>

                <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/50">
                  <Checkbox
                    id="firstPayment"
                    checked={registerFirstPayment}
                    onCheckedChange={(checked) => setRegisterFirstPayment(checked as boolean)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="firstPayment" className="cursor-pointer font-medium">
                      Registrar primer pago
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {registerFirstPayment
                        ? `Se registrará un pago de $${Number(selectedPlan?.price || 0).toFixed(2)}`
                        : "Solo se registrará la fecha de vencimiento"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/50">
                  <Checkbox id="sendWelcome" checked={sendWelcome} onCheckedChange={(checked) => setSendWelcome(checked as boolean)} />
                  <div className="flex-1">
                    <Label htmlFor="sendWelcome" className="cursor-pointer font-medium">
                      Enviar correo de bienvenida
                    </Label>
                    <p className="text-xs text-muted-foreground">Se enviará un email de bienvenida al cliente con los detalles de su registro</p>
                  </div>
                </div>

                {registerFirstPayment && (
                  <div className="space-y-4 p-3 rounded-lg border">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Monto</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={`${Number(selectedPlan?.price || 0).toFixed(2)}`}
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Precio del plan: ${Number(selectedPlan?.price || 0).toFixed(2)}</p>
                      </div>
                      <div className="grid gap-2">
                        <Label>Método de pago</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Efectivo">Efectivo USD</SelectItem>
                            <SelectItem value="Pago Movil">Pago Móvil</SelectItem>
                            <SelectItem value="Efectivo bs">Efectivo Bs</SelectItem>
                            <SelectItem value="Transferencia">Transferencia</SelectItem>
                            <SelectItem value="Transferencia BS">Transferencia BS</SelectItem>
                            <SelectItem value="USDT">USDT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {["Pago Movil", "Transferencia", "Transferencia BS", "USDT"].includes(paymentMethod) && (
                      <div className="grid gap-2">
                        <Label>Referencia</Label>
                        <Input placeholder="Número de referencia o hash" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
                      </div>
                    )}
                    {METHODS_IN_BS.includes(paymentMethod) && (
                      <div className="grid gap-2">
                        <Label>Tasa del pago (opcional)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Ej: 45.50"
                          value={paymentRate}
                          onChange={(e) => setPaymentRate(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Tasa Bs/USD al momento del pago</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : user ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
