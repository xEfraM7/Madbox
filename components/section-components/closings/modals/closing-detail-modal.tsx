"use client"

import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Download, DollarSign, Users, Banknote, TrendingUp, Calendar } from "lucide-react"
import { exportMonthlyClosing } from "@/lib/actions/closings"
import type { MonthlyClosing } from "@/types/database"

interface ClosingDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  closing: MonthlyClosing | null
}

export function ClosingDetailModal({ open, onOpenChange, closing }: ClosingDetailModalProps) {
  const formatPeriod = (period: string) => {
    const [year, month] = period.split("-")
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
                    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    return `${months[parseInt(month) - 1]} ${year}`
  }

  const formatCurrency = (amount: number, currency: string = "$") => {
    return `${currency} ${amount.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("es-VE", { 
      day: "2-digit", 
      month: "2-digit", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const exportMutation = useMutation({
    mutationFn: () => exportMonthlyClosing(closing!.id),
    onSuccess: (data) => {
      // Create and download file
      const blob = new Blob([data], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `cierre-${closing!.period}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success("Exportación completada")
    },
    onError: () => {
      toast.error("Error al exportar el cierre")
    },
  })

  if (!closing) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {formatPeriod(closing.period)}
              </DialogTitle>
              <DialogDescription>
                Cerrado el {formatDate(closing.closed_at)} por {closing.admin?.name || "Sistema"}
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Total Revenue */}
          <div className="flex justify-between items-center p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <span className="font-medium">Ingresos Totales (USD)</span>
            </div>
            <span className="text-2xl font-bold text-green-500">{formatCurrency(closing.total_revenue_usd)}</span>
          </div>

          <Separator />

          {/* Revenue Breakdown */}
          <div className="space-y-3">
            <h4 className="font-medium">Desglose de Ingresos por Método</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                <p className="font-medium text-sm">Membresías ({closing.membership_payments_count} pagos)</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bolívares:</span>
                    <span>{formatCurrency(closing.membership_revenue_bs, "Bs")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">USD Efectivo:</span>
                    <span>{formatCurrency(closing.membership_revenue_usd_cash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">USDT:</span>
                    <span>{formatCurrency(closing.membership_revenue_usdt, "USDT")}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                <p className="font-medium text-sm">Clases Especiales ({closing.class_payments_count} pagos)</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bolívares:</span>
                    <span>{formatCurrency(closing.class_revenue_bs, "Bs")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">USD Efectivo:</span>
                    <span>{formatCurrency(closing.class_revenue_usd_cash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">USDT:</span>
                    <span>{formatCurrency(closing.class_revenue_usdt, "USDT")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Member Metrics */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Métricas de Miembros
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{closing.active_members}</p>
                <p className="text-xs text-muted-foreground">Activos</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-blue-500">{closing.new_members}</p>
                <p className="text-xs text-muted-foreground">Nuevos</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-red-500">{closing.expired_members}</p>
                <p className="text-xs text-muted-foreground">Vencidos</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-orange-500">{closing.frozen_members}</p>
                <p className="text-xs text-muted-foreground">Congelados</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{closing.total_members}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold flex items-center justify-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  {closing.retention_rate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Retención</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Fund Balances */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <Banknote className="h-4 w-4 text-purple-500" />
                Fondos al Cierre
              </h4>
              <Badge variant={closing.funds_reset ? "default" : "secondary"}>
                {closing.funds_reset ? "Fondos reseteados" : "Fondos preservados"}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                <p className="text-lg font-bold">{formatCurrency(closing.funds_bs, "Bs")}</p>
                <p className="text-xs text-muted-foreground">Bolívares</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <p className="text-lg font-bold">{formatCurrency(closing.funds_usd_cash)}</p>
                <p className="text-xs text-muted-foreground">USD Efectivo</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-center">
                <p className="text-lg font-bold">{formatCurrency(closing.funds_usdt, "USDT")}</p>
                <p className="text-xs text-muted-foreground">USDT</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Exchange Rates */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Tasas de Cambio Registradas</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-2 rounded bg-muted/50 text-center">
                <p className="text-sm font-medium">{closing.rate_bcv.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">BCV</p>
              </div>
              <div className="p-2 rounded bg-muted/50 text-center">
                <p className="text-sm font-medium">{closing.rate_usdt.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">USDT</p>
              </div>
              <div className="p-2 rounded bg-muted/50 text-center">
                <p className="text-sm font-medium">{closing.rate_custom.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Custom</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {closing.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Notas</h4>
                <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
                  {closing.notes}
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
