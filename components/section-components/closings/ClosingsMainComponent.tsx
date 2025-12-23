"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Calendar, 
  Lock, 
  DollarSign, 
  Users, 
  TrendingUp, 
  TrendingDown,
  Loader2,
  Banknote,
  Bitcoin,
  Eye
} from "lucide-react"
import { usePermissions } from "@/lib/hooks/use-permissions"
import { getMonthlyClosings, getCurrentMonthPreview } from "@/lib/actions/closings"
import { CloseMonthModal } from "./modals/close-month-modal"
import { ClosingDetailModal } from "./modals/closing-detail-modal"
import type { MonthlyClosing } from "@/types/database"

export default function ClosingsMainComponent() {
  const { hasPermission } = usePermissions()
  const [closeModalOpen, setCloseModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedClosing, setSelectedClosing] = useState<MonthlyClosing | null>(null)
  const [compareClosingId, setCompareClosingId] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)

  const { data: closings = [], isLoading: closingsLoading } = useQuery({
    queryKey: ["monthly-closings"],
    queryFn: getMonthlyClosings,
  })

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ["current-month-preview"],
    queryFn: getCurrentMonthPreview,
  })

  useEffect(() => {
    setIsClient(true)
  }, [])

  const canEdit = hasPermission("closings.edit")

  const formatPeriod = (period: string) => {
    const [year, month] = period.split("-")
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
                    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    return `${months[parseInt(month) - 1]} ${year}`
  }

  const formatCurrency = (amount: number, currency: string = "$") => {
    if (!isClient) return `${currency}0`
    return `${currency} ${amount.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (date: string) => {
    if (!isClient) return ""
    return new Date(date).toLocaleDateString("es-VE", { 
      day: "2-digit", 
      month: "2-digit", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  // Calculate comparison percentages
  const calculateChange = (current: number, previous: number): { value: number; isPositive: boolean } | null => {
    if (previous === 0) return null
    const change = ((current - previous) / previous) * 100
    return { value: Math.abs(change), isPositive: change >= 0 }
  }

  const compareClosing = closings.find(c => c.id === compareClosingId)

  const handleViewDetail = (closing: MonthlyClosing) => {
    setSelectedClosing(closing)
    setDetailModalOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Cierres Mensuales</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-2">Gestiona los cierres de período y revisa el historial</p>
          </div>
          {canEdit && (
            <Button 
              onClick={() => setCloseModalOpen(true)}
              className="w-full md:w-auto"
            >
              <Lock className="mr-2 h-4 w-4" />
              Cerrar Mes
            </Button>
          )}
        </div>

        {/* Current Month Preview Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <CardTitle className="text-base md:text-lg">
                    {preview ? formatPeriod(preview.period) : "Mes Actual"} - Vista Previa
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">Datos acumulados del período actual (sin cerrar)</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="border-primary text-primary w-fit">En curso</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {previewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : preview ? (
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-xs md:text-sm text-muted-foreground">Ingresos Totales (USD)</p>
                  <p className="text-xl md:text-2xl font-bold text-green-500">{formatCurrency(preview.total_revenue_usd)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs md:text-sm text-muted-foreground">Miembros Activos</p>
                  <p className="text-xl md:text-2xl font-bold">{preview.members.active}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs md:text-sm text-muted-foreground">Nuevos Miembros</p>
                  <p className="text-xl md:text-2xl font-bold text-blue-500">{preview.members.new}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs md:text-sm text-muted-foreground">Tasa de Retención</p>
                  <p className="text-xl md:text-2xl font-bold">{preview.members.retention.toFixed(1)}%</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4 text-sm">No hay datos disponibles</p>
            )}
          </CardContent>
        </Card>

        {/* Comparison Section */}
        {closings.length > 1 && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-base md:text-lg">Comparar Períodos</CardTitle>
                <Select value={compareClosingId || ""} onValueChange={setCompareClosingId}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Seleccionar período" />
                  </SelectTrigger>
                  <SelectContent>
                    {closings.map((closing) => (
                      <SelectItem key={closing.id} value={closing.id}>
                        {formatPeriod(closing.period)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            {compareClosing && preview && (
              <CardContent>
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                  <ComparisonCard
                    label="Ingresos USD"
                    current={preview.total_revenue_usd}
                    previous={compareClosing.total_revenue_usd}
                    format={(v) => formatCurrency(v)}
                  />
                  <ComparisonCard
                    label="Miembros Activos"
                    current={preview.members.active}
                    previous={compareClosing.active_members}
                    format={(v) => v.toString()}
                  />
                  <ComparisonCard
                    label="Nuevos Miembros"
                    current={preview.members.new}
                    previous={compareClosing.new_members}
                    format={(v) => v.toString()}
                  />
                  <ComparisonCard
                    label="Retención"
                    current={preview.members.retention}
                    previous={compareClosing.retention_rate}
                    format={(v) => `${v.toFixed(1)}%`}
                  />
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Historical Closings Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Historial de Cierres ({closings.length})</CardTitle>
            <CardDescription className="text-xs md:text-sm">Registro de todos los cierres mensuales realizados</CardDescription>
          </CardHeader>
          <CardContent>
            {closingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs md:text-sm">Período</TableHead>
                      <TableHead className="hidden sm:table-cell text-xs md:text-sm">Ingresos USD</TableHead>
                      <TableHead className="hidden md:table-cell text-xs md:text-sm">Miembros</TableHead>
                      <TableHead className="hidden lg:table-cell text-xs md:text-sm">Fondos Reset</TableHead>
                      <TableHead className="hidden md:table-cell text-xs md:text-sm">Cerrado</TableHead>
                      <TableHead className="text-right text-xs md:text-sm">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                          No hay cierres registrados
                        </TableCell>
                      </TableRow>
                    ) : (
                      closings.map((closing) => (
                        <TableRow key={closing.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewDetail(closing)}>
                          <TableCell className="text-xs md:text-sm">
                            <div>
                              <p className="font-medium">{formatPeriod(closing.period)}</p>
                              <p className="text-xs text-muted-foreground sm:hidden">
                                {formatCurrency(closing.total_revenue_usd)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell font-medium text-green-500 text-xs md:text-sm">
                            {formatCurrency(closing.total_revenue_usd)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs md:text-sm">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span>{closing.active_members} activos</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant={closing.funds_reset ? "default" : "secondary"} className="text-xs">
                              {closing.funds_reset ? "Sí" : "No"}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-xs md:text-sm">
                            {formatDate(closing.closed_at)}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" onClick={() => handleViewDetail(closing)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CloseMonthModal 
        open={closeModalOpen} 
        onOpenChange={setCloseModalOpen}
        preview={preview}
      />

      <ClosingDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        closing={selectedClosing}
      />
    </DashboardLayout>
  )
}

// Comparison Card Component
function ComparisonCard({ 
  label, 
  current, 
  previous, 
  format 
}: { 
  label: string
  current: number
  previous: number
  format: (v: number) => string
}) {
  const change = previous !== 0 ? ((current - previous) / previous) * 100 : null
  const isPositive = change !== null && change >= 0

  return (
    <div className="space-y-1 p-2 md:p-3 rounded-lg bg-muted/50">
      <p className="text-xs md:text-sm text-muted-foreground">{label}</p>
      <p className="text-lg md:text-xl font-bold">{format(current)}</p>
      {change !== null && (
        <div className={`flex items-center gap-1 text-xs md:text-sm ${isPositive ? "text-green-500" : "text-red-500"}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{Math.abs(change).toFixed(1)}%</span>
          <span className="text-muted-foreground">vs anterior</span>
        </div>
      )}
    </div>
  )
}
