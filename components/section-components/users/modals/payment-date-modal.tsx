"use client"

import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DateInput } from "@/components/ui/date-input"
import { Loader2, AlertCircle } from "lucide-react"
import { updatePaymentDate } from "@/lib/actions/members"

interface PaymentDateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: any
}

export function PaymentDateModal({ open, onOpenChange, user }: PaymentDateModalProps) {
  const queryClient = useQueryClient()
  const [newPaymentDate, setNewPaymentDate] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (open && user) {
      setNewPaymentDate(user.payment_date || "")
      setError("")
    }
  }, [open, user])

  const dateMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) => updatePaymentDate(id, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] })
      showToast.success("Fecha actualizada", `La fecha de pago de ${user?.name} ha sido actualizada.`)
      onOpenChange(false)
    },
    onError: () => {
      showToast.error("Error", "No se pudo actualizar la fecha de pago.")
    },
  })

  const validateDate = (date: string) => {
    if (!date) return "Selecciona una fecha"
    return ""
  }

  const handleSubmit = () => {
    const validationError = validateDate(newPaymentDate)
    if (validationError) {
      setError(validationError)
      return
    }
    dateMutation.mutate({ id: user.id, date: newPaymentDate })
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Cambiar fecha de pago</DialogTitle>
          <DialogDescription>Selecciona la nueva fecha de pago para {user.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {user.payment_date && (
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground">Fecha actual de vencimiento</p>
              <p className="font-medium">{new Date(user.payment_date + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="payment-date">Nueva fecha de pago</Label>
            <DateInput
              value={newPaymentDate}
              onChange={(value) => { setNewPaymentDate(value); setError("") }}
            />
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Puedes seleccionar cualquier fecha, incluso anterior a hoy</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={dateMutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!newPaymentDate || dateMutation.isPending}>
            {dateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
