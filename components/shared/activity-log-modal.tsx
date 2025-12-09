"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DateInput } from "@/components/ui/date-input"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"
import { getActivityLog } from "@/lib/actions/activity"

interface ActivityLogModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ActivityLogModal({ open, onOpenChange }: ActivityLogModalProps) {
  const [dateFilter, setDateFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")

  // Calcular fechas según el filtro seleccionado
  const getDateRange = () => {
    const today = new Date()
    let start: string | undefined
    let end: string | undefined

    switch (dateFilter) {
      case "today":
        start = today.toISOString().split("T")[0]
        end = today.toISOString().split("T")[0]
        break
      case "week":
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 7)
        start = weekAgo.toISOString().split("T")[0]
        break
      case "month":
        const monthAgo = new Date(today)
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        start = monthAgo.toISOString().split("T")[0]
        break
      case "custom":
        start = startDate || undefined
        end = endDate || undefined
        break
    }

    return { start, end }
  }

  const { start, end } = getDateRange()

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["activity-log-full", dateFilter, startDate, endDate],
    queryFn: () => getActivityLog(100, start, end),
    enabled: open,
  })

  // Filtrar por tipo de actividad
  const filteredActivities = activities.filter((activity: any) => {
    if (typeFilter === "all") return true
    return activity.entity_type === typeFilter
  })

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatAction = (activity: any): string => {
    const { action, entity_name, details } = activity
    switch (action) {
      case "payment_registered": return `Registró pago de ${entity_name || "cliente"} por ${details?.amount || 0}`
      case "payment_deleted": return `Eliminó pago de ${entity_name || "cliente"}`
      case "member_created": return `Registró miembro: ${entity_name}`
      case "member_updated": return `Actualizó miembro: ${entity_name}`
      case "member_deleted": return `Eliminó miembro: ${entity_name}`
      case "class_created": return `Creó clase: ${entity_name}`
      case "class_deleted": return `Eliminó clase: ${entity_name}`
      case "class_payment_registered": return `Pago de clase: ${entity_name}`
      case "class_payment_deleted": return `Eliminó pago de clase`
      case "rate_updated": return `Actualizó tasa ${entity_name} a ${details?.rate}`
      default: return `${action}: ${entity_name || ""}`
    }
  }

  const getActivityColor = (entityType: string): string => {
    switch (entityType) {
      case "payment": case "special_class_payment": return "bg-green-500"
      case "member": return "bg-blue-500"
      case "special_class": return "bg-purple-500"
      case "exchange_rate": return "bg-orange-500"
      default: return "bg-gray-500"
    }
  }

  const clearFilters = () => {
    setDateFilter("all")
    setStartDate("")
    setEndDate("")
    setTypeFilter("all")
  }

  const hasActiveFilters = dateFilter !== "all" || typeFilter !== "all"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Historial de Actividad</DialogTitle>
          <DialogDescription>Registro completo de todas las acciones realizadas</DialogDescription>
        </DialogHeader>

        {/* Filtros */}
        <div className="space-y-4 pb-4 border-b">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Período</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por fecha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el historial</SelectItem>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Último mes</SelectItem>
                  <SelectItem value="custom">Rango personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Tipo de actividad</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las actividades</SelectItem>
                  <SelectItem value="payment">Pagos</SelectItem>
                  <SelectItem value="member">Clientes</SelectItem>
                  <SelectItem value="special_class">Clases</SelectItem>
                  <SelectItem value="special_class_payment">Pagos de clases</SelectItem>
                  <SelectItem value="exchange_rate">Tasas de cambio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {dateFilter === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Desde</Label>
                <DateInput value={startDate} onChange={setStartDate} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Hasta</Label>
                <DateInput value={endDate} onChange={setEndDate} />
              </div>
            </div>
          )}

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" />
              Limpiar filtros
            </Button>
          )}
        </div>

        {/* Contador de resultados */}
        <div className="text-sm text-muted-foreground">
          {filteredActivities.length} actividad{filteredActivities.length !== 1 ? "es" : ""} encontrada{filteredActivities.length !== 1 ? "s" : ""}
        </div>

        {/* Lista de actividades */}
        <div className="h-[400px] overflow-y-auto pr-2">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay actividad registrada para los filtros seleccionados</p>
          ) : (
            <div className="space-y-3">
              {filteredActivities.map((activity: any) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${getActivityColor(activity.entity_type)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{activity.admin_name || "Sistema"}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(activity.created_at)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatAction(activity)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
