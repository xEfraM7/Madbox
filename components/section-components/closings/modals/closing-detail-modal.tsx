"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Download, 
  Loader2, 
  Users, 
  DollarSign, 
  TrendingUp,
  Banknote,
  Bitcoin,
  Calendar
} from "lucide-react"
import { exportMonthlyClosing } from "@/lib/actions/closings"
import { showToast } from "@/lib/sweetalert"
import type { MonthlyClosing } from "@/types/database"

interface ClosingDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  closing: MonthlyClosing | null
}

export function ClosingDetailModal({ open, onOpenChange, closing }: ClosingDetailModalProps) {
  const [activeTab, setActiveTab] = useState("overview")

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!closing) throw new Error("No closing data")
      const content = await exportMonthlyClosing(closing.id)
      
      // Create and download file
      const element = document.createElement("a")
      element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(content))
      element.setAttribute("download", `cierre-${closing.period}.txt`)
      element.style.display = "none"
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)
    },
    onSuccess: () => {
      showToast.success("Cierre exportado exitosamente")
    },
    onError: (error) => {
      showToast.error(error instanceof Error ? error.message : "Error al exportar")
    },
  })

  if (!closing) return null

  const formatCurrency = (amount: number, currency: string = "$") => {
    return `${currency} ${amount.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatPeriod = (period: string) => {
    const [year, month] = period.split("-")
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
                    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    return `${months[parseInt(month) - 1]} ${year}`
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{formatPeriod(closing.period)}</DialogTitle>
          <DialogDescription>
            Cerrado el {formatDate(closing.closed_at)} por {closing.admin?.name || "Sistema"}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Resumen</TabsTrigger>
            <TabsTrigger value="revenue" className="text-xs sm:text-sm">Ingresos</TabsTrigger>
            <TabsTrigger value="members" className="text-xs sm:text-sm">Miembros</TabsTrigger>
            <TabsTrigger value="funds" className="hidden sm:block">Fondos</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Total en USD
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-500">
                    {formatCurrency(closing.total_revenue_usd)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Miembros Activos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{closing.active_members}</p>
                </CardContent>
              </Card>
            </div>

            {closing.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Notas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{closing.notes}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Estado de Fondos</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={closing.funds_reset ? "default" : "secondary"}>
                  {closing.funds_reset ? "Fondos Reseteados" : "Fondos No Reseteados"}
                </Badge>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ingresos por Membresías</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bolívares:</span>
                    <span className="font-medium">Bs {closing.membership_revenue_bs.toLocaleString("es-VE")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">USD Efectivo:</span>
                    <span className="font-medium">${closing.membership_revenue_usd_cash.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">USDT:</span>
                    <span className="font-medium">USDT {closing.membership_revenue_usdt.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-medium">
                    <span>Total Pagos:</span>
                    <span>{closing.membership_payments_count}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ingresos por Clases Especiales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bolívares:</span>
                    <span className="font-medium">Bs {closing.class_revenue_bs.toLocaleString("es-VE")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">USD Efectivo:</span>
                    <span className="font-medium">${closing.class_revenue_usd_cash.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">USDT:</span>
                    <span className="font-medium">USDT {closing.class_revenue_usdt.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-medium">
                    <span>Total Pagos:</span>
                    <span>{closing.class_payments_count}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4">
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs sm:text-sm">Activos</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{closing.active_members}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs sm:text-sm">Nuevos</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-500">{closing.new_members}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs sm:text-sm">Vencidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-500">{closing.expired_members}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs sm:text-sm">Congelados</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-orange-500">{closing.frozen_members}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Métricas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Miembros:</span>
                    <span className="font-medium">{closing.total_members}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tasa de Retención:</span>
                    <span className="font-medium">{closing.retention_rate.toFixed(2)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Funds Tab */}
          <TabsContent value="funds" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Fondos al Cierre</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bolívares:</span>
                    <span className="font-medium">Bs {closing.funds_bs.toLocaleString("es-VE")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">USD Efectivo:</span>
                    <span className="font-medium">${closing.funds_usd_cash.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">USDT:</span>
                    <span className="font-medium">USDT {closing.funds_usdt.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tasas de Cambio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">BCV:</span>
                    <span className="font-medium">{closing.rate_bcv.toFixed(2)} Bs/$</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">USDT:</span>
                    <span className="font-medium">{closing.rate_usdt.toFixed(2)} Bs/USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Personalizada:</span>
                    <span className="font-medium">{closing.rate_custom.toFixed(2)} Bs/$</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
          <Button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            className="gap-2"
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Exportar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
