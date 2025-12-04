"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Calendar, CreditCard, Mail, Phone, User, Snowflake } from "lucide-react"

interface UserDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: any
}

const statusLabels: Record<string, string> = {
  active: "Activo",
  frozen: "Congelado",
  pending: "Pendiente",
  expired: "Vencido",
}

const paymentHistory = [
  { date: "15/03/2024", amount: "$50.00", status: "paid", method: "Tarjeta" },
  { date: "15/02/2024", amount: "$50.00", status: "paid", method: "Efectivo" },
  { date: "15/01/2024", amount: "$50.00", status: "paid", method: "Tarjeta" },
]

export function UserDetailModal({ open, onOpenChange, user }: UserDetailModalProps) {
  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle del Usuario</DialogTitle>
          <DialogDescription>Información completa y historial del miembro</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Información Personal</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div><p className="text-sm font-medium">Nombre</p><p className="text-sm text-muted-foreground">{user.name}</p></div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div><p className="text-sm font-medium">Correo</p><p className="text-sm text-muted-foreground">{user.email}</p></div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div><p className="text-sm font-medium">Teléfono</p><p className="text-sm text-muted-foreground">{user.phone}</p></div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div><p className="text-sm font-medium">Fecha de inicio</p><p className="text-sm text-muted-foreground">{user.startDate}</p></div>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Plan actual</p><Badge variant="outline" className="mt-1">{user.plan}</Badge></div>
                <div><p className="text-sm font-medium">Estado</p><Badge className="mt-1">{statusLabels[user.status]}</Badge></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Historial de Pagos</CardTitle>
              <CardDescription>Últimas transacciones realizadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paymentHistory.map((payment, index) => (
                  <div key={index} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <div><p className="text-sm font-medium">{payment.date}</p><p className="text-xs text-muted-foreground">{payment.method}</p></div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{payment.amount}</p>
                      <Badge variant="outline" className="text-xs">Pagado</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 bg-transparent"><Calendar className="mr-2 h-4 w-4" />Cambiar fecha de pago</Button>
            <Button variant="outline" className="flex-1 bg-transparent"><Snowflake className="mr-2 h-4 w-4" />{user.frozen ? "Descongelar" : "Congelar"} mensualidad</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
