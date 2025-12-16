"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface PaymentDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: any
}

export function PaymentDetailModal({ open, onOpenChange, payment }: PaymentDetailModalProps) {
  if (!payment) return null

  const formatDate = (date: string) => {
    if (!date) return "-"
    return new Date(date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  const formatAmount = (amount: number, method: string) => {
    const bsMethods = ["Pago Movil", "Efectivo bs", "Transferencia BS"]
    if (bsMethods.includes(method)) {
      return `Bs. ${amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`
    }
    return `$${amount.toFixed(2)}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Detalle del Pago</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">Cliente</span>
            <span className="font-medium">{payment.members?.name || payment.member_name || "Sin cliente"}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">Plan/Clase</span>
            <Badge variant="outline">{payment.plans?.name || payment.special_classes?.name || "Sin plan"}</Badge>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">Monto</span>
            <span className="font-bold text-lg">{formatAmount(Number(payment.amount), payment.method)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">Método</span>
            <span>{payment.method || "-"}</span>
          </div>
          {payment.reference && (
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Referencia</span>
              <span className="font-mono text-sm">{payment.reference}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">Fecha de pago</span>
            <span>{formatDate(payment.payment_date)}</span>
          </div>
          {payment.due_date && (
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Vencimiento</span>
              <span>{formatDate(payment.due_date)}</span>
            </div>
          )}
          {payment.payment_rate && (
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Tasa del pago</span>
              <span className="font-medium">{Number(payment.payment_rate).toFixed(2)} Bs/$</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
