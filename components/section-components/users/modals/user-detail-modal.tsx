"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Calendar, CreditCard, Mail, Phone, User, Snowflake, Loader2 } from "lucide-react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { PaymentDateModal } from "./payment-date-modal"
import { toggleFreeze } from "@/lib/actions/members"
import { getMemberPayments } from "@/lib/actions/payments"

interface UserDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: any
}

const statusLabels: Record<string, string> = {
  active: "Activo",
  frozen: "Congelado",
  expired: "Vencido",
}

const paymentStatusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Pagado", variant: "default" },
  pending: { label: "Pendiente", variant: "secondary" },
  overdue: { label: "Vencido", variant: "destructive" },
}

export function UserDetailModal({ open, onOpenChange, user }: UserDetailModalProps) {
  const queryClient = useQueryClient()
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false)
  const [dateModalOpen, setDateModalOpen] = useState(false)

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["member-payments", user?.id],
    queryFn: () => getMemberPayments(user?.id),
    enabled: open && !!user?.id,
  })

  const freezeMutation = useMutation({
    mutationFn: ({ id, frozen }: { id: string; frozen: boolean }) => toggleFreeze(id, frozen),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] })
      const action = user?.frozen ? "descongelada" : "congelada"
      showToast.success(`Membresía ${action}`, `La membresía de ${user?.name} ha sido ${action}.`)
      setFreezeDialogOpen(false)
    },
    onError: () => {
      showToast.error("Error", `No se pudo ${user?.frozen ? "descongelar" : "congelar"} la membresía.`)
    },
  })

  if (!user) return null

  const formatDate = (date: string) => {
    if (!date) return "No definida"
    return new Date(date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del Cliente</DialogTitle>
            <DialogDescription>Información completa y historial del cliente</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Información Personal</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0"><p className="text-sm font-medium">Nombre</p><p className="text-sm text-muted-foreground truncate">{user.name}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0"><p className="text-sm font-medium">Correo</p><p className="text-sm text-muted-foreground truncate">{user.email}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0"><p className="text-sm font-medium">Teléfono</p><p className="text-sm text-muted-foreground">{user.phone || "No registrado"}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0"><p className="text-sm font-medium">Fecha de pago</p><p className="text-sm text-muted-foreground">{formatDate(user.payment_date)}</p></div>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">Plan actual</p><Badge variant="outline" className="mt-1">{user.plans?.name || "Sin plan"}</Badge></div>
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
                {loadingPayments ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay pagos registrados</p>
                ) : (
                  <div className="space-y-3">
                    {payments.map((payment: any) => {
                      // Determinar la moneda según el método de pago
                      const bsMethods = ["Pago Movil", "Efectivo bs", "Transferencia BS"]
                      const isBs = bsMethods.includes(payment.method)
                      const currencySymbol = isBs ? "Bs." : "$"
                      const formattedAmount = isBs
                        ? Number(payment.amount).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : Number(payment.amount).toFixed(2)

                      return (
                        <div key={payment.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                          <div className="flex items-center gap-3">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{formatDate(payment.payment_date)}</p>
                              <p className="text-xs text-muted-foreground">{payment.method || "Sin método"}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{currencySymbol} {formattedAmount}</p>
                            <Badge variant={paymentStatusLabels[payment.status]?.variant || "secondary"} className="text-xs">
                              {paymentStatusLabels[payment.status]?.label || payment.status}
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setDateModalOpen(true)}>
                <Calendar className="mr-2 h-4 w-4" /><span className="hidden sm:inline">Cambiar fecha de pago</span><span className="sm:hidden">Fecha de pago</span>
              </Button>
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setFreezeDialogOpen(true)}>
                <Snowflake className="mr-2 h-4 w-4" />{user.frozen ? "Descongelar" : "Congelar"}<span className="hidden sm:inline"> mensualidad</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={freezeDialogOpen}
        onOpenChange={setFreezeDialogOpen}
        title={user.frozen ? "Descongelar membresía" : "Congelar membresía"}
        description={user.frozen
          ? `¿Deseas reactivar la membresía de ${user.name}?`
          : `¿Deseas congelar la membresía de ${user.name}? El cliente no podrá acceder al gimnasio mientras esté congelado.`
        }
        confirmText={user.frozen ? "Descongelar" : "Congelar"}
        variant={user.frozen ? "success" : "warning"}
        onConfirm={() => freezeMutation.mutate({ id: user.id, frozen: !user.frozen })}
        isLoading={freezeMutation.isPending}
      />

      <PaymentDateModal open={dateModalOpen} onOpenChange={setDateModalOpen} user={user} />
    </>
  )
}
