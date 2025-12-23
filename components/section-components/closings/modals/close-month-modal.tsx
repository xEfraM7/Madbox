"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertTriangle, DollarSign, Users, Banknote, Bitcoin } from "lucide-react"
import { createMonthlyClosing } from "@/lib/actions/closings"
import type { MonthlyClosingPreview } from "@/types/database"

interface CloseMonthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: MonthlyClosingPreview | undefined
}

export function CloseMonthModal({ open, onOpenChange, preview }: CloseMonthModalProps) {
  const queryClient = useQueryClient()
  const [resetFunds, setResetFunds] = useState(false)
  const [notes, setNotes] = useState("")

  const formatPeriod = (period: string) => {
    const [year, month] = period.split("-")
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
                    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    return `${months[parseInt(month) - 1]} ${year}`
  }

  const formatCurrency = (amount: number, currency: string = "$") => {
    return `${currency} ${amount.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const closeMutation = useMutation({
    mutationFn: () => createMonthlyClosing(preview!.period, resetFunds, notes || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthly-closings"] })
      queryClient.invalidateQueries({ queryKey: ["current-month-preview"] })
      queryClient.invalidateQueries({ queryKey: ["payments-funds-summary"] })
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] })
      toast.success("Mes cerrado exitosamente", {
        description: `El cierre de ${formatPeriod(preview!.period)} ha sido completado.`
      })
      onOpenChange(false)
      setResetFunds(false)
      setNotes("")
    },
    onError: (error: Error) => {
      toast.error("Error al cerrar el mes", {
        description: error.message
      })
    },
  })

  if (!preview) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cerrar Mes - {formatPeriod(preview.period)}</DialogTitle>
          <DialogDescription>
            Revisa los datos antes de confirmar el cierre. Esta acción creará un registro inmutable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Revenue Summary */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              Resumen de Ingresos
            </h4>
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm text-muted-foreground">Membresías</p>
                <div className="space-y-1 mt-1">
                  <p className="text-sm">Bs: {formatCurrency(preview.membership_revenue.bs, "Bs")}</p>
                  <p className="text-sm">USD: {formatCurrency(preview.membership_revenue.usd_cash)}</p>
                  <p className="text-sm">USDT: {formatCurrency(preview.membership_revenue.usdt, "USDT")}</p>
                  <p className="text-xs text-muted-foreground">{preview.membership_revenue.count} pagos</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clases Especiales</p>
                <div className="space-y-1 mt-1">
                  <p className="text-sm">Bs: {formatCurrency(preview.class_revenue.bs, "Bs")}</p>
                  <p className="text-sm">USD: {formatCurrency(preview.class_revenue.usd_cash)}</p>
                  <p className="text-sm">USDT: {formatCurrency(preview.class_revenue.usdt, "USDT")}</p>
                  <p className="text-xs text-muted-foreground">{preview.class_revenue.count} pagos</p>
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <span className="font-medium">Total en USD (Tasa BCV)</span>
              <span className="text-xl font-bold text-green-500">{formatCurrency(preview.total_revenue_usd)}</span>
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
                <p className="text-2xl font-bold">{preview.members.active}</p>
                <p className="text-xs text-muted-foreground">Activos</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-blue-500">{preview.members.new}</p>
                <p className="text-xs text-muted-foreground">Nuevos</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-red-500">{preview.members.expired}</p>
                <p className="text-xs text-muted-foreground">Vencidos</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-orange-500">{preview.members.frozen}</p>
                <p className="text-xs text-muted-foreground">Congelados</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{preview.members.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{preview.members.retention.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Retención</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Fund Balances */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Banknote className="h-4 w-4 text-purple-500" />
              Fondos Actuales
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                <p className="text-lg font-bold">{formatCurrency(preview.funds.bs, "Bs")}</p>
                <p className="text-xs text-muted-foreground">Bolívares</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <p className="text-lg font-bold">{formatCurrency(preview.funds.usd_cash)}</p>
                <p className="text-xs text-muted-foreground">USD Efectivo</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-center">
                <p className="text-lg font-bold">{formatCurrency(preview.funds.usdt, "USDT")}</p>
                <p className="text-xs text-muted-foreground">USDT</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Exchange Rates */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Tasas de Cambio al Cierre</h4>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>BCV: {preview.rates.bcv.toFixed(2)}</span>
              <span>USDT: {preview.rates.usdt.toFixed(2)}</span>
              <span>Custom: {preview.rates.custom.toFixed(2)}</span>
            </div>
          </div>

          <Separator />

          {/* Fund Reset Option */}
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <Checkbox 
                id="resetFunds" 
                checked={resetFunds} 
                onCheckedChange={(checked) => setResetFunds(checked as boolean)}
              />
              <div className="space-y-1">
                <Label htmlFor="resetFunds" className="font-medium cursor-pointer">
                  Resetear fondos después del cierre
                </Label>
                <p className="text-sm text-muted-foreground">
                  Los balances de todos los fondos se establecerán en cero
                </p>
              </div>
            </div>
            {resetFunds && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Esta acción reseteará todos los fondos a cero. Los balances actuales quedarán registrados en el cierre.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Agregar notas o comentarios sobre este cierre..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={closeMutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
            {closeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Cierre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
