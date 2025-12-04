"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Search, MoreVertical, Edit, AlertCircle, Loader2 } from "lucide-react"
import { PaymentFormModal } from "./modals/payment-form-modal"
import { getPayments } from "@/lib/actions/payments"
import { getMembers } from "@/lib/actions/members"

const statusConfig = {
  paid: { variant: "default" as const, label: "Pagado" },
}

export default function PaymentsMainComponent() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<any>(null)

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: getPayments,
  })

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: getMembers,
  })

  const expiredMembers = members.filter((m: any) => m.status === "expired")

  const filteredPayments = payments.filter((payment: any) => {
    const matchesSearch = payment.members?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          payment.members?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const filteredExpiredMembers = expiredMembers.filter((member: any) => {
    return member.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
           member.email?.toLowerCase().includes(searchTerm.toLowerCase())
  })

  const totalPaid = payments.filter((p: any) => p.status === "paid").reduce((sum: number, p: any) => sum + Number(p.amount), 0)

  const formatDate = (date: string) => {
    if (!date) return "-"
    return new Date(date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

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

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Recaudado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">${totalPaid.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Clientes Vencidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">{expiredMembers.length}</div>
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
                      <TableHead>Plan</TableHead>
                      <TableHead>Fecha de pago</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpiredMembers.map((member: any) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.name}</TableCell>
                        <TableCell><Badge variant="outline">{member.plans?.name || "Sin plan"}</Badge></TableCell>
                        <TableCell className="text-destructive">{formatDate(member.payment_date)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => { setSelectedPayment({ member_id: member.id, plan_id: member.plan_id }); setIsModalOpen(true) }}>
                            <Plus className="mr-2 h-4 w-4" />Registrar pago
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
                      <TableHead>Plan</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Fecha de pago</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No se encontraron pagos</TableCell>
                      </TableRow>
                    ) : (
                      filteredPayments.map((payment: any) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">{payment.members?.name || "Sin cliente"}</TableCell>
                          <TableCell><Badge variant="outline">{payment.plans?.name || "Sin plan"}</Badge></TableCell>
                          <TableCell className="font-medium">${Number(payment.amount).toFixed(2)}</TableCell>
                          <TableCell className="text-muted-foreground">{payment.method || "-"}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(payment.payment_date)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(payment.due_date)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
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
            )}
          </CardContent>
        </Card>
      </div>

      <PaymentFormModal open={isModalOpen} onOpenChange={setIsModalOpen} payment={selectedPayment} />
    </DashboardLayout>
  )
}
