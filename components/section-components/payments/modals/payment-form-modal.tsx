"use client"

import { useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MemberSearchSelect } from "@/components/ui/member-search-select"
import { DateInput } from "@/components/ui/date-input"
import { Loader2 } from "lucide-react"
import { createPayment, updatePayment } from "@/lib/actions/payments"
import { getMembers } from "@/lib/actions/members"
import { getPlans } from "@/lib/actions/plans"

interface PaymentFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment?: any
}

interface FormData {
  member_id: string
  plan_id: string
  amount: string
  method: string
  reference: string
  payment_date: string
  due_date: string
  payment_rate: string
}

const METHODS_WITH_REFERENCE = ["Pago Movil", "Transferencia", "Transferencia BS", "USDT"]
const METHODS_IN_BS = ["Pago Movil", "Efectivo bs", "Transferencia BS"]

/**
 * Calcula la fecha de vencimiento basada en el día de corte del miembro
 * Si el miembro tiene un payment_date anterior, usa ese día como referencia
 * Si no, usa el día del pago actual
 */
function calculateDueDate(paymentDate: string, memberPaymentDate?: string): string {
  const paymentDateObj = new Date(paymentDate + "T00:00:00")
  
  // Determinar el día de corte: usar el del miembro si existe, sino usar el del pago
  let cutoffDay = paymentDateObj.getDate()
  
  if (memberPaymentDate) {
    const memberDate = new Date(memberPaymentDate + "T00:00:00")
    cutoffDay = memberDate.getDate()
  }
  
  // Crear la fecha de vencimiento en el próximo mes con el mismo día de corte
  const dueDate = new Date(paymentDateObj.getFullYear(), paymentDateObj.getMonth() + 1, cutoffDay)
  
  // Ajustar si el día no existe en el mes siguiente (ej: 31 -> 28 feb)
  if (dueDate.getDate() !== cutoffDay) {
    dueDate.setDate(0) // Último día del mes anterior
  }
  
  return dueDate.toISOString().split("T")[0]
}

export function PaymentFormModal({ open, onOpenChange, payment }: PaymentFormModalProps) {
  const queryClient = useQueryClient()
  const initialized = useRef(false)
  
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { member_id: "", plan_id: "", amount: "", method: "Efectivo", reference: "", payment_date: "", due_date: "", payment_rate: "" }
  })

  const member_id = watch("member_id")
  const plan_id = watch("plan_id")
  const method = watch("method")

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: getMembers,
    enabled: open,
  })

  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    enabled: open,
  })

  const isEditing = payment?.id

  // Inicializar formulario cuando se abre el modal
  useEffect(() => {
    if (open && members.length > 0 && plans.length > 0) {
      initialized.current = false
      const today = new Date().toISOString().split("T")[0]

      if (isEditing) {
        reset({
          member_id: payment.member_id || "",
          plan_id: payment.plan_id || "",
          amount: payment.amount?.toString() || "",
          method: payment.method || "Efectivo",
          reference: payment.reference || "",
          payment_date: payment.payment_date || "",
          due_date: payment.due_date || "",
          payment_rate: payment.payment_rate?.toString() || ""
        })
      } else if (payment?.member_id) {
        const selectedMember = members.find((m: any) => m.id === payment.member_id)
        const memberPlan = plans.find((p: any) => p.id === payment.plan_id)
        reset({ 
          member_id: payment.member_id, 
          plan_id: payment.plan_id || "", 
          amount: memberPlan?.price?.toString() || "", 
          method: "Efectivo", 
          reference: "",
          payment_date: today,
          due_date: calculateDueDate(today, selectedMember?.payment_date),
          payment_rate: ""
        })
      } else {
        reset({ 
          member_id: "", 
          plan_id: "", 
          amount: "", 
          method: "Efectivo", 
          reference: "",
          payment_date: today,
          due_date: calculateDueDate(today),
          payment_rate: ""
        })
      }
      initialized.current = true
    }
  }, [open, members.length, plans.length, payment, isEditing, reset])

  // Auto-fill cuando el usuario selecciona un miembro manualmente
  const handleMemberChange = (value: string) => {
    setValue("member_id", value)
    if (!isEditing) {
      const selectedMember = members.find((m: any) => m.id === value)
      if (selectedMember?.plan_id) {
        setValue("plan_id", selectedMember.plan_id)
        const memberPlan = plans.find((p: any) => p.id === selectedMember.plan_id)
        if (memberPlan) {
          setValue("amount", memberPlan.price.toString())
        }
      }
    }
  }

  // Auto-fill monto cuando cambia el plan
  const handlePlanChange = (value: string) => {
    setValue("plan_id", value)
    if (!isEditing) {
      const selectedPlan = plans.find((p: any) => p.id === value)
      if (selectedPlan) {
        setValue("amount", selectedPlan.price.toString())
      }
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: any) => createPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] })
      queryClient.invalidateQueries({ queryKey: ["payments-funds-summary"] })
      queryClient.invalidateQueries({ queryKey: ["members"] })
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] })
      showToast.success("Pago registrado", "El pago ha sido registrado correctamente." )
      onOpenChange(false)
    },
    onError: () => {
      showToast.error("Error", "No se pudo registrar el pago." )
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => updatePayment(payment.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] })
      queryClient.invalidateQueries({ queryKey: ["payments-funds-summary"] })
      queryClient.invalidateQueries({ queryKey: ["members"] })
      showToast.success("Pago actualizado", "Los cambios han sido guardados." )
      onOpenChange(false)
    },
    onError: () => {
      showToast.error("Error", "No se pudo actualizar el pago." )
    },
  })

  const onSubmit = (data: FormData) => {
    const paymentData = {
      member_id: data.member_id,
      plan_id: data.plan_id,
      amount: parseFloat(data.amount),
      method: data.method,
      reference: METHODS_WITH_REFERENCE.includes(data.method) ? data.reference : null,
      status: "paid",
      payment_date: data.payment_date || null,
      due_date: data.due_date,
      payment_rate: METHODS_IN_BS.includes(data.method) && data.payment_rate ? parseFloat(data.payment_rate) : null
    }

    if (isEditing) {
      updateMutation.mutate(paymentData)
    } else {
      createMutation.mutate(paymentData)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Pago" : "Registrar Nuevo Pago"}</DialogTitle>
          <DialogDescription>{isEditing ? "Modifica la información del pago" : "Registra un nuevo pago de mensualidad"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="member_id">Cliente</Label>
              <MemberSearchSelect
                members={members.map((m: any) => ({ id: m.id, name: m.name, email: m.email }))}
                value={member_id}
                onValueChange={handleMemberChange}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="plan_id">Plan</Label>
              <Select value={plan_id} onValueChange={handlePlanChange}>
                <SelectTrigger><SelectValue placeholder="Selecciona un plan" /></SelectTrigger>
                <SelectContent>
                  {plans.filter((p: any) => p.active).map((plan: any) => (
                    <SelectItem key={plan.id} value={plan.id}>{plan.name} - ${Number(plan.price).toFixed(2)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Monto</Label>
                <Input 
                  id="amount" 
                  type="number" 
                  step="0.01" 
                  {...register("amount", { required: "El monto es requerido" })} 
                  placeholder="0.00" 
                />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="method">Método de pago</Label>
                <Select value={method} onValueChange={(value) => setValue("method", value)}>
                  <SelectTrigger><SelectValue placeholder="Selecciona método" /></SelectTrigger>
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

            {METHODS_WITH_REFERENCE.includes(method) && (
              <div className="grid gap-2">
                <Label htmlFor="reference">Referencia</Label>
                <Input 
                  id="reference" 
                  {...register("reference")} 
                  placeholder="Número de referencia o hash" 
                />
              </div>
            )}

            {METHODS_IN_BS.includes(method) && (
              <div className="grid gap-2">
                <Label htmlFor="payment_rate">Tasa del pago (opcional)</Label>
                <Input 
                  id="payment_rate" 
                  type="number"
                  step="0.01"
                  {...register("payment_rate")} 
                  placeholder="Ej: 45.50" 
                />
                <p className="text-xs text-muted-foreground">Tasa Bs/USD al momento del pago</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="payment_date">Fecha de pago</Label>
                <DateInput 
                  value={watch("payment_date")} 
                  onChange={(value) => {
                    setValue("payment_date", value)
                    if (value && !isEditing) {
                      const selectedMember = members.find((m: any) => m.id === member_id)
                      setValue("due_date", calculateDueDate(value, selectedMember?.payment_date))
                    }
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="due_date">Fecha de vencimiento</Label>
                <DateInput value={watch("due_date")} onChange={(value) => setValue("due_date", value)} />
                {errors.due_date && <p className="text-sm text-destructive">{errors.due_date.message}</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : isEditing ? "Guardar cambios" : "Registrar pago"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
