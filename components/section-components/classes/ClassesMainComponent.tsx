"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, MoreVertical, Edit, Trash2, Calendar, Clock, Loader2, Banknote, DollarSign, Bitcoin } from "lucide-react"
import { ClassFormModal } from "./modals/class-form-modal"
import { SpecialPaymentModal } from "./modals/special-payment-modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { PaymentDetailModal } from "@/components/shared/payment-detail-modal"
import { getSpecialClasses, deleteSpecialClass, getSpecialClassPayments, deleteSpecialClassPayment } from "@/lib/actions/classes"
import { getSpecialClassPaymentsFundsSummary, getExchangeRates } from "@/lib/actions/funds"

export default function ClassesMainComponent() {
  const queryClient = useQueryClient()
  const [isClassModalOpen, setIsClassModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedClass, setSelectedClass] = useState<any>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [classToDelete, setClassToDelete] = useState<any>(null)
  const [deletePaymentDialogOpen, setDeletePaymentDialogOpen] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null)
  const [selectedRate, setSelectedRate] = useState<"bcv" | "usdt" | "cash">("bcv")
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailPayment, setDetailPayment] = useState<any>(null)

  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ["special-classes"],
    queryFn: getSpecialClasses,
  })

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["special-class-payments"],
    queryFn: getSpecialClassPayments,
  })

  const { data: fundsSummary } = useQuery({
    queryKey: ["special-class-funds-summary"],
    queryFn: getSpecialClassPaymentsFundsSummary,
  })

  const { data: exchangeRates = [] } = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: getExchangeRates,
  })

  const bcvRate = exchangeRates.find((r: any) => r.type === "BCV")?.rate || 1
  const usdtRate = exchangeRates.find((r: any) => r.type === "USDT")?.rate || 1

  const getRateValue = () => {
    switch (selectedRate) {
      case "bcv": return bcvRate
      case "usdt": return usdtRate
      case "cash": return usdtRate // Efectivo usa la misma tasa que USDT
      default: return bcvRate
    }
  }

  const getRateLabel = () => {
    switch (selectedRate) {
      case "bcv": return "BCV"
      case "usdt": return "USDT"
      case "cash": return "Efectivo"
      default: return "BCV"
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSpecialClass(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-classes"] })
      showToast.success("Clase eliminada", `${classToDelete?.name} ha sido eliminada.`)
      setDeleteDialogOpen(false)
      setClassToDelete(null)
    },
    onError: () => {
      showToast.error("Error", "No se pudo eliminar la clase.")
    },
  })

  const deletePaymentMutation = useMutation({
    mutationFn: (id: string) => deleteSpecialClassPayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-class-payments"] })
      queryClient.invalidateQueries({ queryKey: ["special-class-funds-summary"] })
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] })
      showToast.success("Pago eliminado", "El pago ha sido eliminado correctamente.")
      setDeletePaymentDialogOpen(false)
      setPaymentToDelete(null)
    },
    onError: () => {
      showToast.error("Error", "No se pudo eliminar el pago.")
    },
  })

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

  const parseSchedule = (schedule: string) => {
    if (!schedule) return { date: null, time: null }
    const match = schedule.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/)
    if (match) {
      const dateObj = new Date(match[1] + "T00:00:00")
      const formattedDate = dateObj.toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short"
      })
      return {
        date: formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1),
        time: `${match[2]} - ${match[3]}`
      }
    }
    return { date: schedule, time: null }
  }

  // Calcular ingresos totales en USD según la tasa seleccionada
  const calculateTotalInUsd = () => {
    const bs = fundsSummary?.bs || 0
    const usdCash = fundsSummary?.usdCash || 0
    const usdt = fundsSummary?.usdt || 0
    const rate = getRateValue()

    const bsInUsd = bs / rate
    return bsInUsd + usdCash + usdt
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-balance">Clases Especiales</h1>
            <p className="text-muted-foreground mt-2">Gestiona clases adicionales y pagos independientes</p>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Clases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{classes.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos Totales</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    Tasa {getRateLabel()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSelectedRate("bcv")}>Tasa BCV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedRate("usdt")}>Tasa USDT</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedRate("cash")}>Tasa Efectivo</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">${calculateTotalInUsd().toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Bs convertidos a {getRateLabel()}: {getRateValue().toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bolso Bolívares</CardTitle>
              <Banknote className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Bs. {(fundsSummary?.bs || 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground">≈ ${((fundsSummary?.bs || 0) / bcvRate).toFixed(2)} USD</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/20 bg-green-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bolso USD Efectivo</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(fundsSummary?.usdCash || 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
          <Card className="border-orange-500/20 bg-orange-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bolso USDT</CardTitle>
              <Bitcoin className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(fundsSummary?.usdt || 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })} USDT</div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Clases Programadas</h2>
              <p className="text-sm text-muted-foreground">Administra el calendario de clases especiales</p>
            </div>
            <Button onClick={() => { setSelectedClass(null); setIsClassModalOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />Crear Clase
            </Button>
          </div>

          {loadingClasses ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : classes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No hay clases registradas
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {classes.map((classItem: any) => (
                <Card key={classItem.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{classItem.name}</CardTitle>
                        <CardDescription className="mt-1">{classItem.instructor}</CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedClass(classItem); setIsClassModalOpen(true) }}>
                            <Edit className="mr-2 h-4 w-4" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setClassToDelete(classItem); setDeleteDialogOpen(true) }} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Precio</span>
                        <span className="font-semibold">${Number(classItem.price).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Capacidad</span>
                        <span>{classItem.capacity} personas</span>
                      </div>
                      <div className="pt-2 border-t space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-yellow-500" />
                          <span>{parseSchedule(classItem.schedule).date || "-"}</span>
                        </div>
                        {parseSchedule(classItem.schedule).time && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-yellow-500" />
                            <span>{parseSchedule(classItem.schedule).time}</span>
                          </div>
                        )}
                      </div>

                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Pagos de Clases</h2>
              <p className="text-sm text-muted-foreground">Historial de pagos por clases especiales</p>
            </div>
            <Button onClick={() => setIsPaymentModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Registrar Pago
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              {loadingPayments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead className="hidden sm:table-cell">Clase</TableHead>
                        <TableHead className="hidden md:table-cell">Método</TableHead>
                        <TableHead className="hidden lg:table-cell">Fecha</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay pagos registrados</TableCell>
                        </TableRow>
                      ) : (
                        payments.map((payment: any) => (
                          <TableRow key={payment.id} className="cursor-pointer" onClick={() => { setDetailPayment(payment); setDetailModalOpen(true) }}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{payment.members?.name || "Sin cliente"}</p>
                                <p className="text-xs text-muted-foreground sm:hidden">{payment.special_classes?.name || "Sin clase"}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{formatAmount(Number(payment.amount), payment.method)}</TableCell>
                            <TableCell className="hidden sm:table-cell">{payment.special_classes?.name || "Sin clase"}</TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">{payment.method || "-"}</TableCell>
                            <TableCell className="hidden lg:table-cell text-muted-foreground">{formatDate(payment.payment_date)}</TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setPaymentToDelete(payment); setDeletePaymentDialogOpen(true) }} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
      </div>

      <ClassFormModal open={isClassModalOpen} onOpenChange={setIsClassModalOpen} classItem={selectedClass} />
      <SpecialPaymentModal open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen} />
      <PaymentDetailModal open={detailModalOpen} onOpenChange={setDetailModalOpen} payment={detailPayment} />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar clase"
        description={`¿Estás seguro de que deseas eliminar "${classToDelete?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => deleteMutation.mutate(classToDelete?.id)}
        isLoading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={deletePaymentDialogOpen}
        onOpenChange={setDeletePaymentDialogOpen}
        title="Eliminar pago"
        description={`¿Estás seguro de que deseas eliminar este pago de $${paymentToDelete?.amount}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => deletePaymentMutation.mutate(paymentToDelete?.id)}
        isLoading={deletePaymentMutation.isPending}
      />
    </DashboardLayout>
  )
}
