"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MemberSearchSelect } from "@/components/ui/member-search-select"
import { Loader2 } from "lucide-react"
import { createSpecialClassPayment, getSpecialClasses } from "@/lib/actions/classes"
import { getMembers } from "@/lib/actions/members"

interface SpecialPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface FormData {
  member_id: string
  class_id: string
  amount: string
  method: string
  reference: string
  payment_rate: string
}

const METHODS_WITH_REFERENCE = ["Pago Movil", "Transferencia", "Transferencia BS", "USDT"]
const METHODS_IN_BS = ["Pago Movil", "Efectivo bs", "Transferencia BS"]

export function SpecialPaymentModal({ open, onOpenChange }: SpecialPaymentModalProps) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { member_id: "", class_id: "", amount: "", method: "Efectivo", reference: "", payment_rate: "" }
  })

  const member_id = watch("member_id")
  const class_id = watch("class_id")
  const method = watch("method")

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: getMembers,
    enabled: open,
  })

  const { data: classes = [] } = useQuery({
    queryKey: ["special-classes"],
    queryFn: getSpecialClasses,
    enabled: open,
  })

  useEffect(() => {
    if (open) {
      reset({ member_id: "", class_id: "", amount: "", method: "Efectivo", reference: "", payment_rate: "" })
    }
  }, [open, reset])

  const handleClassChange = (value: string) => {
    setValue("class_id", value)
    const selectedClass = classes.find((c: any) => c.id === value)
    if (selectedClass) {
      setValue("amount", selectedClass.price.toString())
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: any) => createSpecialClassPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-class-payments"] })
      queryClient.invalidateQueries({ queryKey: ["special-class-funds-summary"] })
      queryClient.invalidateQueries({ queryKey: ["special-classes"] })
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] })
      showToast.success("Pago registrado", "El pago ha sido registrado correctamente." )
      onOpenChange(false)
    },
    onError: () => {
      showToast.error("Error", "No se pudo registrar el pago." )
    },
  })

  const onSubmit = (data: FormData) => {
    const paymentData = {
      member_id: data.member_id,
      class_id: data.class_id,
      amount: parseFloat(data.amount),
      method: data.method,
      reference: METHODS_WITH_REFERENCE.includes(data.method) ? data.reference : null,
      status: "paid",
      payment_date: new Date().toISOString().split("T")[0],
      payment_rate: METHODS_IN_BS.includes(data.method) && data.payment_rate ? parseFloat(data.payment_rate) : null
    }
    createMutation.mutate(paymentData)
  }

  const isLoading = createMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Registrar Pago de Clase</DialogTitle>
          <DialogDescription>Registra un pago por una clase especial</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="member_id">Cliente</Label>
              <MemberSearchSelect
                members={members.map((m: any) => ({ id: m.id, name: m.name, email: m.email }))}
                value={member_id}
                onValueChange={(value) => setValue("member_id", value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="class_id">Clase</Label>
              <Select value={class_id} onValueChange={handleClassChange}>
                <SelectTrigger><SelectValue placeholder="Selecciona una clase" /></SelectTrigger>
                <SelectContent>
                  {classes.map((classItem: any) => (
                    <SelectItem key={classItem.id} value={classItem.id}>{classItem.name} - ${Number(classItem.price).toFixed(2)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Monto</Label>
                <Input id="amount" type="number" step="0.01" {...register("amount", { required: "El monto es requerido" })} placeholder="0.00" />
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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Registrar pago"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
