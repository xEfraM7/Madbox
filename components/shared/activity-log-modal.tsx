"use client"

import { useQuery } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { getActivityLog } from "@/lib/actions/activity"

interface ActivityLogModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ActivityLogModal({ open, onOpenChange }: ActivityLogModalProps) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["activity-log-full"],
    queryFn: () => getActivityLog(50),
    enabled: open,
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
      case "payment_registered": return `Registró pago de ${entity_name || "cliente"} por $${details?.amount || 0}`
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
      default: return "bg-gray-500"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Historial de Actividad</DialogTitle>
          <DialogDescription>Registro completo de todas las acciones realizadas</DialogDescription>
        </DialogHeader>
        <div className="h-[500px] overflow-y-auto pr-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay actividad registrada</p>
          ) : (
            <div className="space-y-3">
              {activities.map((activity: any) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <div className={`w-2 h-2 rounded-full mt-2 ${getActivityColor(activity.entity_type)}`} />
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
