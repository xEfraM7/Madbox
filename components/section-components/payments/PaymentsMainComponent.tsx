"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Search, MoreVertical, Edit, Trash2, AlertCircle, Loader2, Banknote, DollarSign, Bitcoin } from "lucide-react"
import { PaymentFormModal } from "./modals/payment-form-modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { PaymentDetailModal } from "@/components/shared/payment-detail-modal"
import { getPayments, deletePayment } from "@/lib/actions/payments"
import { getMembers } from "@/lib/actions/members"
import { getPaymentsFundsSummaryByMonth, getExchangeRates } from "@/lib/actions/funds"



export default function PaymentsMainComponent() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<any>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null)
  const [selectedRate, setSelectedRate] = useState<"bcv" | "usdt" | "cash" | "custom">("bcv")
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailPayment, setDetailPayment] = useState<any>(null)

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: getPayments,
  })

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: getMembers,
  })

  const { data: fundsSummary } = useQuery({
    queryKey: ["payments-funds-summary-month"],
    queryFn: () => getPaymentsFundsSummaryByMonth(0),
  })

  const { data: exchangeRates = [] } = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: getExchangeRates,
  })

  // Obtener mes actual
  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split("T")[0]
  const monthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0]
  
  const currentMonthName = today.toLocaleDateString("es-ES", { month: "long", year: "numeric" })

  const bcvRate = exchangeRates.find((r: any) => r.type === "BCV")?.rate || 1
  const usdtRate = exchangeRates.find((r: any) => r.type === "USDT")?.rate || 1
  const customRate = exchangeRates.find((r: any) => r.type === "CUSTOM")?.rate || 1

  const getRateValue = () => {
    switch (selectedRate) {
      case "bcv": return bcvRate
      case "usdt": return usdtRate
      case "cash": return usdtRate
      case "custom": return customRate
      default: return bcvRate
    }
  }

  const getRateLabel = () => {
    switch (selectedRate) {
      case "bcv": return "BCV"
      case "usdt": return "USDT"
      case "cash": return "Efectivo"
      case "custom": return "Custom"
      default: return "BCV"
    }
  }

  const calculateTotalInUsd = () => {
    const bs = fundsSummary?.bs || 0
    const usdCash = fundsSummary?.usdCash || 0
    const usdt = fundsSummary?.usdt || 0
    const rate = getRateValue()
    
    const bsInUsd = bs / rate
    return bsInUsd + usdCash + usdt
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] })
      queryClient.invalidateQueries({ queryKey: ["payments-funds-summary-month"] })
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] })
      showToast.success("Pago eliminado", "El pago ha sido eliminado correctamente." )
      setDeleteDialogOpen(false)
      setPaymentToDelete(null)
    },
    onError: () => {
      showToast.error("Error", "No se pudo eliminar el pago." )
    },
  })

  const expiredMembers = members.filter((m: any) => m.status === "expired")

  // Filtrar pagos del mes actual
  const currentMonthPayments = payments.filter((payment: any) => {
    const paymentDate = payment.payment_date
    return paymentDate >= monthStart && paymentDate <= monthEnd
  })

  const filteredPayments = currentMonthPayments.filter((payment: any) => {
    const matchesSearch = payment.members?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          payment.members?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const filteredExpiredMembers = expiredMembers.filter((member: any) => {
    return member.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
           member.email?.toLowerCase().includes(searchTerm.toLowerCase())
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-balance">Gestión de Pagos</h1>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-muted-foreground">Mostrando pagos de</p>
              <Badge variant="secondary" className="capitalize">{currentMonthName}</Badge>
            </div>
          </div>
          <Button onClick={() => { setSelectedPayment(null); setIsModalOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            Registrar Pago
          </Button>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
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
                  <DropdownMenuItem onClick={() => setSelectedRate("custom")}>Tasa Personalizada</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">${calculateTotalInUsd().toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Bs a {getRateLabel()}: {getRateValue().toFixed(2)}</p>
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
          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Clientes Vencidos</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{expiredMembers.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
          </CardContent>
        </Card>

        {filteredExpiredMembers.length > 0 && (
          <Card className="border-destructive">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <CardTitle className="text-lg">Clientes con pago vencido ({filteredExpiredMembers.length})</CardTitle>
                  <CardDescription>Estos clientes tienen su fecha de pago vencida</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="hidden sm:table-cell">Plan</TableHead>
                      <TableHead className="hidden md:table-cell">Fecha de pago</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpiredMembers.map((member: any) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-xs text-destructive sm:hidden">{formatDate(member.payment_date)}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell"><Badge variant="outline">{member.plans?.name || "Sin plan"}</Badge></TableCell>
                        <TableCell className="hidden md:table-cell text-destructive">{formatDate(member.payment_date)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => { setSelectedPayment({ member_id: member.id, plan_id: member.plan_id }); setIsModalOpen(true) }}>
                            <Plus className="mr-2 h-4 w-4 hidden sm:inline" /><span className="hidden sm:inline">Registrar pago</span><span className="sm:hidden">Pagar</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Historial de Pagos ({filteredPayments.length})</CardTitle>
            <CardDescription>Registro de todos los pagos realizados</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
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
                      <TableHead className="hidden sm:table-cell">Método</TableHead>
                      <TableHead className="hidden lg:table-cell">Tasa</TableHead>
                      <TableHead className="hidden md:table-cell">Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No se encontraron pagos</TableCell>
                      </TableRow>
                    ) : (
                      filteredPayments.map((payment: any) => (
                        <TableRow key={payment.id} className="cursor-pointer" onClick={() => { setDetailPayment(payment); setDetailModalOpen(true) }}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{payment.members?.name || "Sin cliente"}</p>
                              <p className="text-xs text-muted-foreground sm:hidden">{payment.method}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{formatAmount(Number(payment.amount), payment.method)}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">{payment.method || "-"}</TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">{payment.payment_rate ? `${Number(payment.payment_rate).toFixed(2)}` : "-"}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">{formatDate(payment.payment_date)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setSelectedPayment(payment); setIsModalOpen(true) }}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setPaymentToDelete(payment); setDeleteDialogOpen(true) }} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
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

      <PaymentFormModal open={isModalOpen} onOpenChange={setIsModalOpen} payment={selectedPayment} />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar pago"
        description={`¿Estás seguro de que deseas eliminar este pago de $${paymentToDelete?.amount}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => deleteMutation.mutate(paymentToDelete?.id)}
        isLoading={deleteMutation.isPending}
      />

      <PaymentDetailModal 
        open={detailModalOpen} 
        onOpenChange={setDetailModalOpen} 
        payment={detailPayment} 
      />
    </DashboardLayout>
  )
}
