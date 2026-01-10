"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Search, MoreVertical, Edit, Trash2, Eye, Snowflake, Calendar, Loader2 } from "lucide-react"
import { UserFormModal } from "./modals/user-form-modal"
import { UserDetailModal } from "./modals/user-detail-modal"
import { PaymentDateModal } from "./modals/payment-date-modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { getMembers, deleteMember, toggleFreeze } from "@/lib/actions/members"
import { getPlans } from "@/lib/actions/plans"

const statusConfig = {
  active: { variant: "default" as const, label: "Activo" },
  frozen: { variant: "outline" as const, label: "Congelado" },
  expired: { variant: "destructive" as const, label: "Vencido" },
}

export default function UsersMainComponent() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [planFilter, setPlanFilter] = useState("all")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false)
  const [paymentDateModalOpen, setPaymentDateModalOpen] = useState(false)
  const [clientToAction, setClientToAction] = useState<any>(null)

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: getMembers,
  })

  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMember(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] })
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
      showToast.success("Cliente eliminado", `${clientToAction?.name} ha sido eliminado correctamente.`)
      setDeleteDialogOpen(false)
      setClientToAction(null)
    },
    onError: () => {
      showToast.error("Error al eliminar", "No se pudo eliminar el cliente. Intenta de nuevo.")
    },
  })

  const freezeMutation = useMutation({
    mutationFn: ({ id, frozen }: { id: string; frozen: boolean }) => toggleFreeze(id, frozen),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] })
      const action = clientToAction?.frozen ? "descongelada" : "congelada"
      showToast.success(`Membresía ${action}`, `La membresía de ${clientToAction?.name} ha sido ${action}.`)
      setFreezeDialogOpen(false)
      setClientToAction(null)
    },
    onError: () => {
      showToast.error("Error", `No se pudo ${clientToAction?.frozen ? "descongelar" : "congelar"} la membresía.`)
    },
  })

  const filteredClients = clients.filter((client: any) => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) || client.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || client.status === statusFilter
    const matchesPlan = planFilter === "all" || client.plans?.name === planFilter
    return matchesSearch && matchesStatus && matchesPlan
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-balance">Gestión de Clientes</h1>
            <p className="text-muted-foreground mt-2">Administra todos los miembros del gimnasio</p>
          </div>
          <Button onClick={() => { setSelectedClient(null); setIsModalOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Cliente
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nombre o correo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Filtrar por estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="frozen">Congelado</SelectItem>
                  <SelectItem value="expired">Vencido</SelectItem>
                </SelectContent>
              </Select>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger><SelectValue placeholder="Filtrar por plan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los planes</SelectItem>
                  {plans.map((plan: any) => (
                    <SelectItem key={plan.id} value={plan.name}>{plan.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Clientes ({filteredClients.length})</CardTitle>
            <CardDescription>Vista completa de todos los miembros registrados</CardDescription>
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
                      <TableHead>Nombre</TableHead>
                      <TableHead className="hidden sm:table-cell">Correo</TableHead>
                      <TableHead className="hidden md:table-cell">Plan</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No se encontraron clientes</TableCell>
                      </TableRow>
                    ) : (
                      filteredClients.map((client: any) => (
                        <TableRow key={client.id} className="cursor-pointer" onClick={() => { setSelectedClient(client); setIsDetailModalOpen(true) }}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{client.name}</p>
                              <p className="text-xs text-muted-foreground sm:hidden">{client.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">{client.email}</TableCell>
                          <TableCell className="hidden md:table-cell"><Badge variant="outline">{client.plans?.name || "Sin plan"}</Badge></TableCell>
                          <TableCell><Badge variant={statusConfig[client.status as keyof typeof statusConfig]?.variant || "secondary"}>{statusConfig[client.status as keyof typeof statusConfig]?.label || client.status}</Badge></TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setSelectedClient(client); setIsDetailModalOpen(true) }}><Eye className="mr-2 h-4 w-4" />Ver detalle</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedClient(client); setIsModalOpen(true) }}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setClientToAction(client); setFreezeDialogOpen(true) }}><Snowflake className="mr-2 h-4 w-4" />{client.frozen ? "Descongelar" : "Congelar"}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setClientToAction(client); setPaymentDateModalOpen(true) }}><Calendar className="mr-2 h-4 w-4" />Cambiar fecha de pago</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setClientToAction(client); setDeleteDialogOpen(true) }} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
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

      <UserFormModal open={isModalOpen} onOpenChange={setIsModalOpen} user={selectedClient} />
      <UserDetailModal open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen} user={selectedClient} />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar cliente"
        description={`¿Estás seguro de que deseas eliminar a ${clientToAction?.name}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => deleteMutation.mutate(clientToAction?.id)}
        isLoading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={freezeDialogOpen}
        onOpenChange={setFreezeDialogOpen}
        title={clientToAction?.frozen ? "Descongelar membresía" : "Congelar membresía"}
        description={clientToAction?.frozen
          ? `¿Deseas reactivar la membresía de ${clientToAction?.name}?`
          : `¿Deseas congelar la membresía de ${clientToAction?.name}? El cliente no podrá acceder al gimnasio mientras esté congelado.`
        }
        confirmText={clientToAction?.frozen ? "Descongelar" : "Congelar"}
        variant={clientToAction?.frozen ? "success" : "warning"}
        onConfirm={() => freezeMutation.mutate({ id: clientToAction?.id, frozen: !clientToAction?.frozen })}
        isLoading={freezeMutation.isPending}
      />

      <PaymentDateModal
        open={paymentDateModalOpen}
        onOpenChange={setPaymentDateModalOpen}
        user={clientToAction}
      />
    </DashboardLayout>
  )
}
