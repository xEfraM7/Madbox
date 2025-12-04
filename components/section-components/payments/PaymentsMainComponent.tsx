"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, MoreVertical, Edit, Eye, AlertCircle } from "lucide-react"
import { PaymentFormModal } from "./modals/payment-form-modal"

const paymentsData = [
  { id: 1, user: "Carlos Rodríguez", plan: "Premium", amount: 49.99, date: "15/03/2024", dueDate: "15/04/2024", status: "paid", method: "Tarjeta" },
  { id: 2, user: "María García", plan: "Básico", amount: 29.99, date: "20/03/2024", dueDate: "20/04/2024", status: "paid", method: "Efectivo" },
  { id: 3, user: "Juan López", plan: "Mensual", amount: 39.99, date: "10/03/2024", dueDate: "10/04/2024", status: "pending", method: "-" },
  { id: 4, user: "Pedro Sánchez", plan: "Básico", amount: 29.99, date: "01/02/2024", dueDate: "01/03/2024", status: "overdue", method: "-" },
]

const statusConfig = {
  paid: { variant: "default" as const, label: "Pagado" },
  pending: { variant: "secondary" as const, label: "Pendiente" },
  overdue: { variant: "destructive" as const, label: "Vencido" },
}

export default function PaymentsMainComponent() {
  const [payments] = useState(paymentsData)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<any>(null)

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch = payment.user.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = [
    { title: "Total Recaudado (Mes)", value: `${payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0).toFixed(2)}`, color: "text-green-500" },
    { title: "Pagos Pendientes", value: payments.filter((p) => p.status === "pending").length, color: "text-yellow-500" },
    { title: "Pagos Vencidos", value: payments.filter((p) => p.status === "overdue").length, color: "text-red-500" },
  ]

  const overdueCount = payments.filter((p) => p.status === "overdue").length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-balance">Gestión de Pagos</h1>
            <p className="text-muted-foreground mt-2">Administra todos los pagos y mensualidades</p>
          </div>
          <Button onClick={() => { setSelectedPayment(null); setIsModalOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            Registrar Pago
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por usuario..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Filtrar por estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="paid">Pagado</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {overdueCount > 0 && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium">Hay {overdueCount} pagos vencidos</p>
                  <p className="text-sm text-muted-foreground">Revisa los pagos marcados como vencidos y contacta a los usuarios</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Lista de Pagos ({filteredPayments.length})</CardTitle>
            <CardDescription>Historial completo de transacciones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Fecha de pago</TableHead>
                    <TableHead>Próximo vencimiento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No se encontraron pagos</TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.user}</TableCell>
                        <TableCell><Badge variant="outline">{payment.plan}</Badge></TableCell>
                        <TableCell className="font-medium">${payment.amount}</TableCell>
                        <TableCell className="text-muted-foreground">{payment.date}</TableCell>
                        <TableCell className="text-muted-foreground">{payment.dueDate}</TableCell>
                        <TableCell><Badge variant={statusConfig[payment.status as keyof typeof statusConfig].variant}>{statusConfig[payment.status as keyof typeof statusConfig].label}</Badge></TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />Ver detalle</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedPayment(payment); setIsModalOpen(true) }}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <PaymentFormModal open={isModalOpen} onOpenChange={setIsModalOpen} payment={selectedPayment} />
    </DashboardLayout>
  )
}
