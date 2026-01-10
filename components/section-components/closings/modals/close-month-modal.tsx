"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, AlertTriangle, CheckCircle2, Banknote, Bitcoin, DollarSign } from "lucide-react"
import { createMonthlyClosing } from "@/lib/actions/closings"
import { showToast } from "@/lib/sweetalert"
import type { MonthlyClosingPreview } from "@/types/database"

interface CloseMonthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview?: MonthlyClosingPreview
}

export function CloseMonthModal({ open, onOpenChange, preview }: CloseMonthModalProps) {
  const [resetFunds, setResetFunds] = useState(true)
  const [notes, setNotes] = useState("")
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("No preview data available")
      return createMonthlyClosing(preview.period, resetFunds, notes)
    },
    onSuccess: () => {
      showToast.success("Mes cerrado exitosamente")
      queryClient.invalidateQueries({ queryKey: ["monthly-closings"] })
      queryClient.invalidateQueries({ queryKey: ["current-month-preview"] })
      queryClient.invalidateQueries({ queryKey: ["funds"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
      onOpenChange(false)
      setNotes("")
      setResetFunds(true)
    },
    onError: (error) => {
      showToast.error(error instanceof Error ? error.message : "Error al cerrar el mes")
    },
  })

  if (!preview) return null

  const formatCurrency = (amount: number, currency: string = "$") => {
    return `${currency} ${amount.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatPeriod = (period: string) => {
    const [year, month] = period.split("-")
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
                    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    return `${months[parseInt(month) - 1]} ${year}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Cerrar Mes: {formatPeriod(preview.period)}</DialogTitle>
          <DialogDescription>
            Revisa los datos antes de confirmar el cierre. Esta acción es irreversible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <Card className="border-green-500/20 bg-green-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Ingresos Totales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-500">
                  {formatCurrency(preview.total_revenue_usd)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {preview.membership_revenue.count + preview.class_revenue.count} pagos
                </p>
              </CardContent>
            </Card>

            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Miembros Activos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{preview.members.active}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {preview.members.new} nuevos este mes
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Desglose de Ingresos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Membresías</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Bolívares:</span>
                      <span className="font-medium">Bs {preview.membership_revenue.bs.toLocaleString("es-VE")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>USD Efectivo:</span>
                      <span className="font-medium">${preview.membership_revenue.usd_cash.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>USDT:</span>
                      <span className="font-medium">USDT {preview.membership_revenue.usdt.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Clases Especiales</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Bolívares:</span>
                      <span className="font-medium">Bs {preview.class_revenue.bs.toLocaleString("es-VE")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>USD Efectivo:</span>
                      <span className="font-medium">${preview.class_revenue.usd_cash.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>USDT:</span>
                      <span className="font-medium">USDT {preview.class_revenue.usdt.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Funds Reset Warning */}
          <Alert className={resetFunds ? "border-orange-500/50 bg-orange-500/5" : "border-muted"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="reset-funds"
                  checked={resetFunds}
                  onChange={(e) => setResetFunds(e.target.checked)}
                  className="mt-1"
                />
                <label htmlFor="reset-funds" className="text-sm cursor-pointer flex-1">
                  <span className="font-medium">Resetear fondos a cero</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Los fondos actuales serán guardados en el cierre y reseteados para el próximo período.
                  </p>
                  {resetFunds && (
                    <div className="mt-2 space-y-1 text-xs">
                      <p>Fondos a resetear:</p>
                      <p>• Bs {preview.funds.bs.toLocaleString("es-VE")}</p>
                      <p>• ${preview.funds.usd_cash.toFixed(2)} USD</p>
                      <p>• USDT {preview.funds.usdt.toFixed(2)}</p>
                    </div>
                  )}
                </label>
              </div>
            </AlertDescription>
          </Alert>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Agrega notas sobre este cierre..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-20 resize-none"
            />
          </div>

          {/* Confirmation Alert */}
          <Alert className="border-red-500/50 bg-red-500/5">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-sm">
              <strong>Advertencia:</strong> Esta acción no se puede deshacer. Asegúrate de que todos los datos sean correctos antes de confirmar.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="gap-2"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cerrando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar Cierre
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
